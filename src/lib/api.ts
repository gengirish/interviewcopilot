import type {
  AnalyticsFunnelResponse,
  AnswerFeedbackPayload,
  AnswerFeedbackSummary,
  AnswerRequest,
  AnswerResponse,
  ExtractResumeResponse,
  SessionDebrief,
  SessionDebriefRequest,
  SessionPrepPlanRequest,
  SessionPrepPlanResponse,
  SessionQuestionBankRequest,
  SessionQuestionBankResponse,
  SessionRewriteRequest,
  SessionRewriteResponse,
  ShareReportRequest,
  ShareReportResponse,
  TeamSummaryResponse,
} from "@/lib/types";

export interface AnalyticsOverview {
  plan: "free" | "pro";
  answersThisMonth: number;
  monthlyQuota: number;
  remainingQuota: number | "unlimited";
  activation?: {
    score: number;
    completed: string[];
    pending: string[];
  };
}

export interface SubscriptionOverview {
  plan: "free" | "pro";
  used: number;
  remaining: number | "unlimited";
  resetAt: string;
}

export interface CurrentUserResponse {
  user: { id: string; email: string } | null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T;
}

export async function getAnswer(payload: AnswerRequest): Promise<AnswerResponse> {
  const body: Record<string, unknown> = {
    question: payload.question,
    role: payload.role,
  };
  if (payload.resumeText !== undefined) body.resumeText = payload.resumeText;
  if (payload.companyMode !== undefined && payload.companyMode !== "generic") {
    body.companyMode = payload.companyMode;
  }

  const res = await fetch("/api/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await parseJson<AnswerResponse>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Failed to generate answer");
  }
  return data;
}

export async function extractResume(file: File): Promise<ExtractResumeResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/extract-resume", {
    method: "POST",
    body: formData,
  });

  const data = await parseJson<ExtractResumeResponse>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Could not parse resume");
  }
  return data;
}

export async function generateSessionDebrief(
  payload: SessionDebriefRequest,
): Promise<SessionDebrief> {
  const res = await fetch("/api/session/debrief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<SessionDebrief & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Could not generate debrief");
  }
  return data;
}

export async function rewriteSessionAnswer(
  payload: SessionRewriteRequest,
): Promise<SessionRewriteResponse> {
  const body: Record<string, unknown> = {
    question: payload.question,
    answer: payload.answer,
    role: payload.role,
  };
  if (payload.companyMode !== undefined && payload.companyMode !== "generic") {
    body.companyMode = payload.companyMode;
  }
  const res = await fetch("/api/session/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await parseJson<SessionRewriteResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Could not rewrite answer");
  }
  return data;
}

export async function generateCompanyQuestionBank(
  payload: SessionQuestionBankRequest,
): Promise<SessionQuestionBankResponse> {
  const body: Record<string, unknown> = { role: payload.role };
  if (payload.companyMode !== undefined && payload.companyMode !== "generic") {
    body.companyMode = payload.companyMode;
  }
  if (payload.resumeText !== undefined && payload.resumeText.trim()) {
    body.resumeText = payload.resumeText;
  }
  if (payload.recentTopics !== undefined && payload.recentTopics.length > 0) {
    body.recentTopics = payload.recentTopics;
  }
  const res = await fetch("/api/session/question-bank", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await parseJson<SessionQuestionBankResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Could not generate question bank");
  }
  return data;
}

export async function generateSessionPrepPlan(
  payload: SessionPrepPlanRequest,
): Promise<SessionPrepPlanResponse> {
  const body: Record<string, unknown> = { role: payload.role };
  if (payload.companyMode !== undefined && payload.companyMode !== "generic") {
    body.companyMode = payload.companyMode;
  }
  if (payload.focusAreas !== undefined && payload.focusAreas.length > 0) {
    body.focusAreas = payload.focusAreas;
  }
  if (payload.debrief !== undefined && payload.debrief !== null) {
    body.debrief = payload.debrief;
  }

  const res = await fetch("/api/session/prep-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await parseJson<SessionPrepPlanResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Could not generate prep plan");
  }
  if (!Array.isArray(data.days) || data.days.length !== 7 || typeof data.summary !== "string") {
    throw new ApiError(500, "Prep plan response was incomplete");
  }
  return data;
}

export async function generateTeamSummary(payload: {
  rubric: string;
  notes: string;
}): Promise<TeamSummaryResponse> {
  const res = await fetch("/api/team/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<TeamSummaryResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Could not generate team summary");
  }
  return data;
}

export async function generateShareReport(payload: ShareReportRequest): Promise<ShareReportResponse> {
  const body: Record<string, unknown> = {
    debrief: payload.debrief,
    role: payload.role,
  };
  if (payload.companyMode !== undefined && payload.companyMode !== "generic") {
    body.companyMode = payload.companyMode;
  }
  if (payload.highlights !== undefined && payload.highlights.length > 0) {
    body.highlights = payload.highlights;
  }

  const res = await fetch("/api/session/share-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await parseJson<ShareReportResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Could not build shareable report");
  }
  if (typeof data.reportText !== "string" || !data.reportText.trim()) {
    throw new ApiError(500, "Share report response was empty");
  }
  return data;
}

export function toUserMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const res = await fetch("/api/analytics/overview");
  const data = await parseJson<AnalyticsOverview>(res);
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error || "Failed to load analytics");
  }
  return data;
}

export type { AnalyticsFunnelResponse };

export async function getAnalyticsFunnel(windowDays: 7 | 30 = 30): Promise<AnalyticsFunnelResponse> {
  const q = windowDays === 7 ? "?window=7" : "";
  const res = await fetch(`/api/analytics/funnel${q}`);
  const data = await parseJson<AnalyticsFunnelResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Failed to load funnel analytics");
  }
  return data;
}

export async function getSubscription(): Promise<SubscriptionOverview> {
  const res = await fetch("/api/billing/subscription");
  const data = await parseJson<SubscriptionOverview>(res);
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error || "Failed to load subscription");
  }
  return data;
}

export async function upgradeToPro(): Promise<{ plan: "pro"; success: true }> {
  const res = await fetch("/api/billing/upgrade", { method: "POST", credentials: "include" });
  const data = await parseJson<{ plan: "pro"; success: true; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Failed to upgrade plan");
  }
  return { plan: "pro", success: true };
}

export async function createCheckoutSession(): Promise<{ checkoutUrl: string }> {
  const res = await fetch("/api/billing/checkout", { method: "POST", credentials: "include" });
  const data = await parseJson<{ checkoutUrl?: string; error?: string; detail?: string }>(res);
  if (!res.ok) {
    const hint = data.detail ? ` ${data.detail}` : "";
    throw new ApiError(res.status, (data.error || "Failed to start checkout") + hint);
  }
  if (!data.checkoutUrl || typeof data.checkoutUrl !== "string") {
    throw new ApiError(500, "Checkout did not return a URL");
  }
  return { checkoutUrl: data.checkoutUrl };
}

export async function getCurrentUser(): Promise<CurrentUserResponse["user"]> {
  const res = await fetch("/api/auth/me");
  const data = await parseJson<CurrentUserResponse>(res);
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new ApiError(res.status, "Failed to load user");
  }
  return data.user;
}

export type ClientAnalyticsEventType =
  | "session_started"
  | "session_completed"
  | "return_session_started"
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
  | "question_bank_generated";

export type ClientAnalyticsMetadata = Record<string, string | number | boolean | null>;

export async function trackEvent(
  eventType: ClientAnalyticsEventType,
  options?: { metadata?: ClientAnalyticsMetadata },
) {
  const payload: Record<string, unknown> = { eventType, source: "client" };
  if (options?.metadata) {
    const cleaned: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(options.metadata)) {
      if (v !== null && v !== undefined) cleaned[k] = v;
    }
    if (Object.keys(cleaned).length > 0) payload.metadata = cleaned;
  }

  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 401) {
    throw new ApiError(res.status, "Failed to track event");
  }
}

export async function submitAnswerFeedback(payload: AnswerFeedbackPayload): Promise<{ ok: true }> {
  const res = await fetch("/api/feedback/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Failed to submit feedback");
  }
  return { ok: true };
}

export interface SessionListItem {
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

export interface SessionQnAItem {
  id: string;
  sessionId: string;
  question: string;
  answer: string;
  source: string;
  feedback: string | null;
  askedAt: string;
  seq: number;
}

export interface SessionDetail {
  session: SessionListItem;
  qnas: SessionQnAItem[];
}

export async function createServerSession(params: {
  role: string;
  companyMode: string;
  resumeSnippet?: string;
}): Promise<SessionListItem> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });
  const data = await parseJson<SessionListItem & { error?: string }>(res);
  if (!res.ok) throw new ApiError(res.status, data.error || "Failed to create session");
  return data;
}

export async function addServerQnA(
  sessionId: string,
  params: { question: string; answer: string; source: string },
): Promise<SessionQnAItem> {
  const res = await fetch(`/api/sessions/${sessionId}/qnas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });
  const data = await parseJson<SessionQnAItem & { error?: string }>(res);
  if (!res.ok) throw new ApiError(res.status, data.error || "Failed to save Q&A");
  return data;
}

export async function endServerSession(
  sessionId: string,
  debriefScore?: number,
): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ debriefScore }),
  });
  if (!res.ok) {
    const data = await parseJson<{ error?: string }>(res);
    throw new ApiError(res.status, data.error || "Failed to end session");
  }
}

export async function listServerSessions(limit = 20, offset = 0): Promise<{ sessions: SessionListItem[] }> {
  const res = await fetch(`/api/sessions?limit=${limit}&offset=${offset}`, {
    credentials: "include",
  });
  const data = await parseJson<{ sessions: SessionListItem[]; error?: string }>(res);
  if (!res.ok) throw new ApiError(res.status, data.error || "Failed to load sessions");
  return data;
}

export async function getServerSession(sessionId: string): Promise<SessionDetail> {
  const res = await fetch(`/api/sessions/${sessionId}`, {
    credentials: "include",
  });
  const data = await parseJson<SessionDetail & { error?: string }>(res);
  if (!res.ok) throw new ApiError(res.status, data.error || "Failed to load session");
  return data;
}

export async function getAnswerFeedbackSummary(monthKey?: string): Promise<AnswerFeedbackSummary> {
  const q = monthKey ? `?month=${encodeURIComponent(monthKey)}` : "";
  const res = await fetch(`/api/feedback/summary${q}`);
  const data = await parseJson<AnswerFeedbackSummary & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Failed to load feedback summary");
  }
  return data;
}
