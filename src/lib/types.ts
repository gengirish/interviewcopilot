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

export interface SessionSummary {
  timestamp: number;
  count: number;
}

export const SESSIONS_STORAGE_KEY = "infinityhire-copilot.sessions";
