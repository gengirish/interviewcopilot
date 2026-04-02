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

/** AI-generated practice questions for the session draft (server may use LLM or fallback). */
export interface QuestionBankResponse {
  questions: string[];
  source?: AnswerSource;
}

export interface AnswerRewriteResponse {
  rewrittenAnswer: string;
  improvements: string[];
  source?: AnswerSource;
}

export interface PrepPlanDay {
  day: number;
  title: string;
  tasks: string[];
}

export interface PrepPlanResponse {
  days: PrepPlanDay[];
  source?: AnswerSource;
}

export interface ShareReportResponse {
  text: string;
  source?: AnswerSource;
}

export interface TeamSummaryResponse {
  summary: string;
  source?: AnswerSource;
}
