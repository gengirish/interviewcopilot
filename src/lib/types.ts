export type Role =
  | "ml-engineer"
  | "data-scientist"
  | "ai-architect"
  | "backend"
  | "fullstack"
  | "product";

/** Optional interview style preset; omit or "generic" = default behavior. */
export type CompanyMode =
  | "generic"
  | "google"
  | "amazon"
  | "razorpay"
  | "atlassian"
  | "flipkart";

export type AnswerSource = "gemini" | "openrouter" | "fallback";

export interface AnswerRequest {
  question: string;
  role: Role;
  resumeText?: string;
  /** When set, tailors emphasis to company interview norms. */
  companyMode?: CompanyMode;
}

export interface AnswerResponse {
  answer?: string;
  source?: AnswerSource;
  error?: string;
}

export interface ExtractResumeResponse {
  text?: string;
  error?: string;
}

export interface QnA {
  id: string;
  question: string;
  answer: string;
  source: AnswerSource | "unknown";
  timestamp: Date;
}

/** Serializable Q&A for APIs (no Date). */
export interface SessionDebriefQnAItem {
  question: string;
  answer: string;
}

export interface SessionDebriefRequest {
  qnas: SessionDebriefQnAItem[];
  role: Role;
  companyMode?: CompanyMode;
}

export interface SessionDebrief {
  overallScore: number;
  strengths: string[];
  improvementAreas: string[];
  nextPracticeQuestions: string[];
  conciseCoachNote: string;
  /** Present when LLM was skipped or failed validation. */
  source?: "openrouter" | "gemini" | "fallback";
}

export interface SessionRewriteRequest {
  question: string;
  answer: string;
  role: Role;
  companyMode?: CompanyMode;
}

export interface SessionRewriteResponse {
  rewrittenAnswer: string;
  improvements: string[];
}

export interface SessionQuestionBankRequest {
  role: Role;
  companyMode?: CompanyMode;
  resumeText?: string;
  recentTopics?: string[];
}

export interface SessionQuestionBankResponse {
  questions: string[];
}

/** Body for POST /api/session/share-report */
export interface ShareReportRequest {
  debrief: SessionDebrief;
  role: Role;
  companyMode?: CompanyMode;
  /** Optional extra bullets to include in the shareable text. */
  highlights?: string[];
}

export interface ShareReportResponse {
  reportText: string;
  /** Reserved for a future public link; omitted in MVP. */
  shareSlug?: string;
}

export type AnswerFeedbackRating = "up" | "down";

export interface AnswerFeedbackPayload {
  qnaId: string;
  question: string;
  answer: string;
  source: AnswerSource | "unknown" | string;
  rating: AnswerFeedbackRating;
  reason?: string;
}

export interface AnswerFeedbackSummary {
  monthKey: string;
  up: number;
  down: number;
  total: number;
  score: number | null;
}

export interface SessionSummary {
  timestamp: number;
  count: number;
}

export const SESSIONS_STORAGE_KEY = "infinityhire-copilot.sessions";

/** Latest session debrief JSON for dashboard prep plan pre-fill (optional). */
export const LAST_SESSION_DEBRIEF_STORAGE_KEY = "infinityhire-copilot.last-session-debrief";

/** Global funnel cohort (signup in window → ever reached step). Rates vs signups. */
export interface FunnelAggregateSummary {
  signups: number;
  session_started: number;
  first_question_asked: number;
  upgraded_to_pro: number;
  activation_rate: number;
  upgrade_rate: number;
}

export interface AnalyticsFunnelResponse {
  user: {
    activationScore: number;
    completed: string[];
    pending: string[];
  };
  aggregate: FunnelAggregateSummary;
}

/** One day in the 7-day prep plan from POST /api/session/prep-plan */
export interface PrepPlanDay {
  day: number;
  goal: string;
  drills: string[];
  expectedOutcome: string;
}

export interface SessionPrepPlanRequest {
  role: Role;
  companyMode?: CompanyMode;
  debrief?: Partial<
    Pick<
      SessionDebrief,
      "overallScore" | "strengths" | "improvementAreas" | "conciseCoachNote" | "nextPracticeQuestions"
    >
  >;
  focusAreas?: string[];
}

export interface SessionPrepPlanResponse {
  days: PrepPlanDay[];
  summary: string;
}

export interface TeamSummaryResponse {
  summary: string;
  source?: AnswerSource;
}
