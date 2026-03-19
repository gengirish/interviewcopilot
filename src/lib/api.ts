import type {
  AnswerRequest,
  AnswerResponse,
  ExtractResumeResponse,
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

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T;
}

export async function getAnswer(payload: AnswerRequest): Promise<AnswerResponse> {
  const res = await fetch("/api/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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

export async function getSubscription(): Promise<SubscriptionOverview> {
  const res = await fetch("/api/billing/subscription");
  const data = await parseJson<SubscriptionOverview>(res);
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error || "Failed to load subscription");
  }
  return data;
}

export async function upgradeToPro(): Promise<{ plan: "pro"; success: true }> {
  const res = await fetch("/api/billing/upgrade", { method: "POST" });
  const data = await parseJson<{ plan: "pro"; success: true; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Failed to upgrade plan");
  }
  return { plan: "pro", success: true };
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

export async function trackEvent(eventType: "session_started" | "first_question_asked" | "upgraded_to_pro") {
  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, source: "client" }),
  });
  if (!res.ok && res.status !== 401) {
    throw new ApiError(res.status, "Failed to track event");
  }
}
