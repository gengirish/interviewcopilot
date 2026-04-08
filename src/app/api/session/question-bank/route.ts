import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import type { CompanyMode, Role } from "@/lib/types";
import {
  consumeRateLimitToken,
  rateLimitKeyForRequest,
} from "@/lib/server/rate-limit";
import { generateText } from "@/lib/server/ai";

const VALID_ROLES = new Set<string>([
  "ml-engineer",
  "data-scientist",
  "ai-architect",
  "backend",
  "fullstack",
  "product",
]);

const VALID_COMPANY_MODES = new Set<CompanyMode>([
  "generic",
  "google",
  "amazon",
  "razorpay",
  "atlassian",
  "flipkart",
]);

const MAX_RESUME_LEN = 4000;
const MAX_RECENT_TOPICS = 15;
const MAX_TOPIC_LEN = 200;
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS_RETURNED = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 15;

const ROLE_LABELS: Record<Role, string> = {
  "ml-engineer": "ML / AI Engineer",
  "data-scientist": "Data Scientist",
  "ai-architect": "AI Solutions Architect",
  backend: "Backend Engineer",
  fullstack: "Full-Stack Engineer",
  product: "Product Manager",
};

const COMPANY_BANK_HINT: Record<CompanyMode, string> = {
  generic: "general senior technical/behavioural follow-ups",
  google: "Google-style depth, ambiguity, scale, and complexity",
  amazon: "Amazon Leadership Principles, ownership, and operational bar",
  razorpay: "Razorpay / payments reliability, APIs, risk, and pragmatic delivery",
  atlassian: "Atlassian collaboration, platform mindset, and written clarity",
  flipkart: "Flipkart-scale commerce, peak traffic, and execution trade-offs",
};

function jsonTooManyRequests(retryAfterSeconds: number): NextResponse {
  const res = NextResponse.json(
    {
      error: "Too many question bank requests. Please wait a minute and try again.",
      code: "rate_limited",
      retryAfterSeconds,
    },
    { status: 429 },
  );
  res.headers.set("Retry-After", String(retryAfterSeconds));
  return res;
}

function parseQuestionsJson(text: string): { questions?: string[] } | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as { questions?: string[] };
  } catch {
    return null;
  }
}

function normalizeQuestions(raw: unknown, maxItems: number, maxQLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (t.length < 8) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t.slice(0, maxQLen));
    if (out.length >= maxItems) break;
  }
  return out;
}

function buildFallbackQuestionBank(input: {
  role: Role;
  companyMode: CompanyMode;
  resumeText: string;
  recentTopics: string[];
}): string[] {
  const { role, companyMode, resumeText, recentTopics } = input;
  const roleLabel = ROLE_LABELS[role] ?? role;
  const companyHint = COMPANY_BANK_HINT[companyMode] ?? COMPANY_BANK_HINT.generic;
  const topicLine =
    recentTopics.length > 0
      ? recentTopics.slice(0, 3).join(" · ")
      : "your recent practice themes";

  const resumeSnippet = resumeText.replace(/\s+/g, " ").trim().slice(0, 120);

  const qs: string[] = [
    `For a ${roleLabel} loop (${companyHint}): what is the deepest follow-up an interviewer would ask on "${topicLine}"?`,
    `What trade-off would ${companyMode === "generic" ? "a strong hiring bar" : companyMode} push you to defend after you claim success on ${topicLine}?`,
    `Ask me a behavioural question that tests ownership and customer impact for a ${roleLabel}, tailored to ${companyHint}.`,
    `Give a system design or execution drill question for ${roleLabel} that matches ${companyHint}.`,
    `What metric would you use to prove the business value of your answer about ${topicLine}, and how would you defend it under pressure?`,
    `What is a sharp clarifying question the interviewer might ask to expose gaps in your reasoning on ${topicLine}?`,
    `If my background includes: ${resumeSnippet || "typical senior experience"}, what targeted follow-up would you expect next?`,
  ];

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const q of qs) {
    const k = q.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(q);
    if (unique.length >= MIN_QUESTIONS) break;
  }
  while (unique.length < MIN_QUESTIONS) {
    unique.push(
      `What is one more ${companyHint} follow-up that would stress-test depth for a ${roleLabel}?`,
    );
  }
  return unique.slice(0, MAX_QUESTIONS_RETURNED);
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlKey = rateLimitKeyForRequest({
    namespace: "session_question_bank",
    userId: user.id,
    req,
  });
  const rl = consumeRateLimitToken({
    key: rlKey,
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
  });
  if (!rl.allowed) {
    return jsonTooManyRequests(rl.retryAfterSeconds);
  }

  const body = await req.json().catch(() => ({}));
  const roleRaw = typeof body.role === "string" ? body.role : "";
  const companyRaw = body.companyMode;
  const resumeRaw = typeof body.resumeText === "string" ? body.resumeText : "";
  const topicsRaw = body.recentTopics;

  if (!VALID_ROLES.has(roleRaw)) {
    return NextResponse.json({ error: "Invalid role selected." }, { status: 400 });
  }
  const role = roleRaw as Role;

  let companyMode: CompanyMode = "generic";
  if (companyRaw !== undefined && companyRaw !== null && companyRaw !== "") {
    if (typeof companyRaw !== "string" || !VALID_COMPANY_MODES.has(companyRaw as CompanyMode)) {
      return NextResponse.json({ error: "Invalid company mode." }, { status: 400 });
    }
    companyMode = companyRaw as CompanyMode;
  }

  const resumeText = resumeRaw.trim().slice(0, MAX_RESUME_LEN);

  let recentTopics: string[] = [];
  if (topicsRaw !== undefined && topicsRaw !== null) {
    if (!Array.isArray(topicsRaw)) {
      return NextResponse.json({ error: "recentTopics must be an array of strings." }, { status: 400 });
    }
    for (const t of topicsRaw) {
      if (typeof t !== "string") continue;
      const s = t.trim().slice(0, MAX_TOPIC_LEN);
      if (s) recentTopics.push(s);
      if (recentTopics.length >= MAX_RECENT_TOPICS) break;
    }
  }

  const fallback = buildFallbackQuestionBank({ role, companyMode, resumeText, recentTopics });
  const roleLabel = ROLE_LABELS[role] ?? role;
  const companyHint = COMPANY_BANK_HINT[companyMode] ?? COMPANY_BANK_HINT.generic;

  const systemPreamble = `You are an interview coach. Generate follow-up interview questions for practice.
Return ONLY valid JSON (no markdown fences) with this shape:
{"questions":string[]}
Rules:
- Provide at least ${MIN_QUESTIONS} distinct, high-signal questions (max ${MAX_QUESTIONS_RETURNED}).
- Each question is one line, <= 320 characters, no numbering prefix.
- Questions should be specific follow-ups a strong interviewer would ask for the role and company interview style.
- Avoid duplicate wording; vary behavioural, technical depth, trade-offs, and metrics.`;

  const topicsBlock =
    recentTopics.length > 0
      ? `Recent topics already covered in this session:\n${recentTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
      : "No recent topics provided — invent realistic follow-ups for the role.";

  const resumeBlock = resumeText
    ? `Candidate resume excerpt (may be partial):\n${resumeText.slice(0, 2000)}`
    : "No resume text provided.";

  const userContent = `Target role: ${roleLabel}
Company interview style: ${companyHint}

${topicsBlock}

${resumeBlock}`;

  const fullPrompt = `${systemPreamble}\n\n${userContent}`;

  let questions = [...fallback];

  const result = await generateText(fullPrompt, { maxTokens: 700, temperature: 0.55 });
  if (result) {
    const parsed = parseQuestionsJson(result.text);
    if (parsed) {
      const next = normalizeQuestions(parsed.questions, MAX_QUESTIONS_RETURNED, 320);
      if (next.length >= MIN_QUESTIONS) {
        questions = next;
      }
    }
  }

  if (questions.length < MIN_QUESTIONS) {
    questions = buildFallbackQuestionBank({ role, companyMode, resumeText, recentTopics });
  }

  if (questions.length < MIN_QUESTIONS) {
    return NextResponse.json(
      { error: "Could not generate a question bank. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ questions: questions.slice(0, MAX_QUESTIONS_RETURNED) });
}
