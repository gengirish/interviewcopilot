import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import type { CompanyMode, Role } from "@/lib/types";
import {
  consumeRateLimitToken,
  rateLimitKeyForRequest,
} from "@/lib/server/rate-limit";

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

const MAX_QUESTION_LEN = 600;
const MAX_ANSWER_LEN = 4000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

const ROLE_LABELS: Record<Role, string> = {
  "ml-engineer": "ML / AI Engineer",
  "data-scientist": "Data Scientist",
  "ai-architect": "AI Solutions Architect",
  backend: "Backend Engineer",
  fullstack: "Full-Stack Engineer",
  product: "Product Manager",
};

const COMPANY_REWRITE_HINT: Record<CompanyMode, string> = {
  generic: "General tech bar: clarity, trade-offs, concrete examples, and measurable impact.",
  google: "Google-style: crisp structure, depth on complexity and scale, testing/observability, reasoning under ambiguity.",
  amazon: "Amazon-style: STAR for behavioural prompts, Leadership Principles, ownership, customer obsession, operational rigor.",
  razorpay: "Razorpay/fintech: reliability, APIs, idempotency, safe rollouts, risk and fraud awareness.",
  atlassian: "Atlassian-style: collaboration, written clarity, platform thinking, team execution.",
  flipkart: "Flipkart / high-scale commerce: pragmatism, peak-load reliability, speed, stakeholder alignment.",
};

function jsonTooManyRequests(retryAfterSeconds: number): NextResponse {
  const res = NextResponse.json(
    {
      error: "Too many rewrite requests. Please wait a minute and try again.",
      code: "rate_limited",
      retryAfterSeconds,
    },
    { status: 429 },
  );
  res.headers.set("Retry-After", String(retryAfterSeconds));
  return res;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeStringArray(raw: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t) continue;
    out.push(t.slice(0, maxLen));
    if (out.length >= maxItems) break;
  }
  return out;
}

function parseRewriteJson(text: string): { rewrittenAnswer?: string; improvements?: string[] } | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as { rewrittenAnswer?: string; improvements?: string[] };
  } catch {
    return null;
  }
}

function buildFallbackRewrite(input: {
  question: string;
  answer: string;
  role: Role;
  companyMode: CompanyMode;
}): { rewrittenAnswer: string; improvements: string[] } {
  const { question, answer, role, companyMode } = input;
  const roleLabel = ROLE_LABELS[role] ?? role;
  const bar = COMPANY_REWRITE_HINT[companyMode] ?? COMPANY_REWRITE_HINT.generic;

  const condensed = answer.replace(/\s+/g, " ").trim();
  const thesis =
    condensed.length > 280 ? `${condensed.slice(0, 277).trim()}…` : condensed;

  const rewrittenAnswer = `**Role context (${roleLabel}):** ${bar}

**Question:** ${question.slice(0, 200)}${question.length > 200 ? "…" : ""}

**Rewritten answer (tighter delivery):**
1) **Bottom line:** State your recommendation or conclusion in one sentence.
2) **Why it works:** Explain the key trade-offs and constraints that drove the decision, grounded in: ${thesis}
3) **Proof:** Add one concrete metric, latency target, or business outcome (or say what you would measure next).
4) **Close:** One sentence on risks, monitoring, or how you would iterate.

If this was behavioural, reorder into STAR (Situation → Task → Action → Result) using the same facts.`;

  const improvements = [
    "Lead with the direct answer before supporting detail so interviewers hear the headline first.",
    "Name one quantified outcome (latency, accuracy, revenue, reliability) or explicitly flag the gap.",
    `Align examples to this interview bar: ${bar.slice(0, 120)}${bar.length > 120 ? "…" : ""}`,
    "End with a crisp risk or follow-up you would validate in the next sprint.",
  ];

  return { rewrittenAnswer, improvements };
}

function normalizeRewriteResult(
  partial: { rewrittenAnswer?: string; improvements?: string[] } | null,
  fallback: { rewrittenAnswer: string; improvements: string[] },
): { rewrittenAnswer: string; improvements: string[] } {
  if (!partial) return fallback;

  const rawAns =
    typeof partial.rewrittenAnswer === "string" ? partial.rewrittenAnswer.trim() : "";
  const rewrittenAnswer =
    rawAns.length >= 40 ? rawAns.slice(0, 6000) : fallback.rewrittenAnswer;

  let improvements = normalizeStringArray(partial.improvements, 8, 240);
  if (improvements.length < 3) {
    improvements = [...improvements, ...fallback.improvements].slice(0, 6);
  }
  while (improvements.length < 3) {
    improvements.push("Tighten wording and remove filler so the answer fits a 90-second spoken version.");
  }

  return { rewrittenAnswer, improvements: improvements.slice(0, 8) };
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlKey = rateLimitKeyForRequest({
    namespace: "session_rewrite",
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
  const qRaw = typeof body.question === "string" ? body.question.trim() : "";
  const aRaw = typeof body.answer === "string" ? body.answer.trim() : "";
  const roleRaw = typeof body.role === "string" ? body.role : "";
  const companyRaw = body.companyMode;

  if (!qRaw) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }
  if (qRaw.length > MAX_QUESTION_LEN) {
    return NextResponse.json(
      { error: `Question is too long (max ${MAX_QUESTION_LEN} characters).` },
      { status: 400 },
    );
  }
  if (!aRaw) {
    return NextResponse.json({ error: "Answer is required." }, { status: 400 });
  }
  if (aRaw.length > MAX_ANSWER_LEN) {
    return NextResponse.json(
      { error: `Answer is too long (max ${MAX_ANSWER_LEN} characters).` },
      { status: 400 },
    );
  }
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

  const fallback = buildFallbackRewrite({ question: qRaw, answer: aRaw, role, companyMode });
  const roleLabel = ROLE_LABELS[role] ?? role;
  const bar = COMPANY_REWRITE_HINT[companyMode] ?? COMPANY_REWRITE_HINT.generic;

  const systemPreamble = `You are an interview coach. Rewrite the candidate's draft answer to be interview-ready.
Return ONLY valid JSON (no markdown fences) with this exact shape:
{"rewrittenAnswer":string,"improvements":string[]}
Rules:
- rewrittenAnswer: polished answer the candidate could speak; keep facts faithful; 120-350 words unless the topic demands slightly more.
- improvements: exactly 3-5 short bullets (each under 200 chars) explaining what changed and why.
- Preserve technical accuracy; do not invent employers, metrics, or projects not implied by the text.`;

  const userContent = `Role: ${roleLabel}
Interview bar: ${bar}

Interview question:
${qRaw}

Current answer:
${aRaw.slice(0, MAX_ANSWER_LEN)}`;

  const fullPrompt = `${systemPreamble}\n\n${userContent}`;

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GOOGLE_AI_KEY;

  let merged = normalizeRewriteResult(null, fallback);

  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://interview.intelliforge.digital",
          "X-Title": "InfinityHire Copilot",
        },
        body: JSON.stringify({
          model: "anthropic/claude-3-haiku",
          messages: [{ role: "user", content: fullPrompt }],
          max_tokens: 900,
          temperature: 0.35,
        }),
      });
      if (res.ok) {
        const data = await withTimeout(res.json(), 14_000);
        const text = data.choices?.[0]?.message?.content as string | undefined;
        if (text) {
          const parsed = parseRewriteJson(text);
          merged = normalizeRewriteResult(parsed, fallback);
        }
      }
    } catch {
      merged = fallback;
    }
  }

  if (merged === fallback && openrouterKey) {
    /* openrouter failed validation — already fallback */
  }

  const usedLlm = merged.rewrittenAnswer !== fallback.rewrittenAnswer || merged.improvements.some(
    (im, i) => im !== fallback.improvements[i],
  );

  if (!usedLlm && geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
        },
      );
      if (res.ok) {
        const data = await withTimeout(res.json(), 14_000);
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
        if (text) {
          const parsed = parseRewriteJson(text);
          merged = normalizeRewriteResult(parsed, fallback);
        }
      }
    } catch {
      merged = fallback;
    }
  }

  if (!merged.rewrittenAnswer || merged.improvements.length < 3) {
    return NextResponse.json(
      { error: "Could not produce a rewrite. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    rewrittenAnswer: merged.rewrittenAnswer,
    improvements: merged.improvements,
  });
}
