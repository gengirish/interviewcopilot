export type Role =
  | "ml-engineer"
  | "data-scientist"
  | "ai-architect"
  | "backend"
  | "fullstack"
  | "product";

export type AnswerSource = "gemini" | "openrouter" | "fallback";

export interface AnswerRequest {
  question: string;
  role: Role;
  resumeText?: string;
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
