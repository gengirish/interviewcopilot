import { ensureSchema, getPool } from "@/lib/server/db";
import { randomUUID } from "crypto";

export interface DbSession {
  id: string;
  userId: string;
  role: string;
  companyMode: string;
  resumeSnippet: string | null;
  startedAt: string;
  endedAt: string | null;
  questionCount: number;
  debriefScore: number | null;
}

export interface DbQnA {
  id: string;
  sessionId: string;
  question: string;
  answer: string;
  source: string;
  feedback: string | null;
  askedAt: string;
  seq: number;
}

export async function createSession(params: {
  userId: string;
  role: string;
  companyMode: string;
  resumeSnippet?: string;
}): Promise<DbSession> {
  await ensureSchema();
  const id = randomUUID();
  const { rows } = await getPool().query(
    `INSERT INTO interview_sessions (id, user_id, role, company_mode, resume_snippet)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, role, company_mode, resume_snippet, started_at, ended_at, question_count, debrief_score`,
    [id, params.userId, params.role, params.companyMode, params.resumeSnippet?.slice(0, 500) || null],
  );
  return mapSessionRow(rows[0]);
}

export async function addQnA(params: {
  sessionId: string;
  userId: string;
  question: string;
  answer: string;
  source: string;
}): Promise<DbQnA> {
  await ensureSchema();
  const pool = getPool();
  const id = randomUUID();

  // Atomically increment question_count and get the seq number
  const { rows: countRows } = await pool.query(
    `UPDATE interview_sessions
     SET question_count = question_count + 1
     WHERE id = $1 AND user_id = $2
     RETURNING question_count`,
    [params.sessionId, params.userId],
  );
  if (!countRows.length) throw new Error("Session not found");
  const seq = countRows[0].question_count;

  const { rows } = await pool.query(
    `INSERT INTO interview_qnas (id, session_id, question, answer, source, seq)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, session_id, question, answer, source, feedback, asked_at, seq`,
    [id, params.sessionId, params.question.slice(0, 2000), params.answer.slice(0, 10000), params.source, seq],
  );
  return mapQnARow(rows[0]);
}

export async function endSession(sessionId: string, userId: string, debriefScore?: number): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `UPDATE interview_sessions SET ended_at = NOW(), debrief_score = COALESCE($3, debrief_score)
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId, debriefScore ?? null],
  );
}

export async function listSessions(userId: string, limit = 20, offset = 0): Promise<DbSession[]> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT id, user_id, role, company_mode, resume_snippet, started_at, ended_at, question_count, debrief_score
     FROM interview_sessions
     WHERE user_id = $1
     ORDER BY started_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  return rows.map(mapSessionRow);
}

export async function getSessionWithQnAs(
  sessionId: string,
  userId: string,
): Promise<{ session: DbSession; qnas: DbQnA[] } | null> {
  await ensureSchema();
  const pool = getPool();
  const { rows: sessionRows } = await pool.query(
    `SELECT id, user_id, role, company_mode, resume_snippet, started_at, ended_at, question_count, debrief_score
     FROM interview_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  );
  if (!sessionRows.length) return null;

  const { rows: qnaRows } = await pool.query(
    `SELECT id, session_id, question, answer, source, feedback, asked_at, seq
     FROM interview_qnas
     WHERE session_id = $1
     ORDER BY seq`,
    [sessionId],
  );
  return {
    session: mapSessionRow(sessionRows[0]),
    qnas: qnaRows.map(mapQnARow),
  };
}

export async function countSessions(userId: string): Promise<number> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS count FROM interview_sessions WHERE user_id = $1`,
    [userId],
  );
  return rows[0]?.count ?? 0;
}

function mapSessionRow(row: Record<string, unknown>): DbSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    role: row.role as string,
    companyMode: row.company_mode as string,
    resumeSnippet: row.resume_snippet as string | null,
    startedAt: (row.started_at as Date).toISOString(),
    endedAt: row.ended_at ? (row.ended_at as Date).toISOString() : null,
    questionCount: row.question_count as number,
    debriefScore: row.debrief_score as number | null,
  };
}

function mapQnARow(row: Record<string, unknown>): DbQnA {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    question: row.question as string,
    answer: row.answer as string,
    source: row.source as string,
    feedback: row.feedback as string | null,
    askedAt: (row.asked_at as Date).toISOString(),
    seq: row.seq as number,
  };
}
