import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import type { CompanyMode, Role, SessionDebrief } from "@/lib/types";
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

const MAX_QNA_ITEMS = 40;
const MAX_QUESTION_LEN = 600;
const MAX_ANSWER_LEN = 4000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

const ROLE_LABELS: Record<Role, string> = {
  "ml-engineer": "ML / AI Engineer",
  "data-scientist": "Data Scientist",
  "ai-architect": "AI Solutions Architect",
  backend: "Backend Engineer",
  fullstack: "Full-Stack Engineer",
  product: "Product Manager",
};

const COMPANY_DEBRIEF_CONTEXT: Record<CompanyMode, string> = {
  generic: "General tech interview bar: clarity, depth, trade-offs, and concrete examples.",
  google: "Google-style: signal on problem decomposition, algorithms/system design depth, clarity under ambiguity, and measurable impact.",
  amazon: "Amazon-style: Leadership Principles via STAR, ownership, customer obsession, and operational rigor at scale.",
  razorpay: "Razorpay / fintech: reliability, API and payments thinking, risk/fraud awareness, and pragmatic shipping.",
  atlassian: "Atlassian-style: collaboration, written clarity, platform thinking, and team/agile execution.",
  flipkart: "Flipkart / high-scale e-commerce: pragmatism, execution speed, reliability under peak load, and stakeholder alignment.",
};

function jsonTooManyRequests(retryAfterSeconds: number): NextResponse {
  const res = NextResponse.json(
    {
      error: "Too many debrief requests. Please wait a minute and try again.",
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

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
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

function parseDebriefJson(text: string): Partial<SessionDebrief> | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as Partial<SessionDebrief>;
  } catch {
    return null;
  }
}

function buildFallbackDebrief(input: {
  role: Role;
  companyMode: CompanyMode;
  qnas: { question: string; answer: string }[];
}): SessionDebrief {
  const { role, companyMode, qnas } = input;
  const roleLabel = ROLE_LABELS[role] ?? role;
  const n = qnas.length;
  const avgQ = n
    ? Math.round(
        qnas.reduce((acc, q) => acc + Math.min(q.question.length, 200), 0) / Math.max(n, 1),
      )
    : 0;
  const avgA = n
    ? Math.round(
        qnas.reduce((acc, q) => acc + Math.min(q.answer.length, 500), 0) / Math.max(n, 1),
      )
    : 0;
  const base = clampInt(55 + Math.min(25, n * 4) + Math.min(15, Math.floor(avgA / 80)), 0, 100);

  const strengths: string[] = [];
  if (n >= 3) strengths.push(`You ran a substantive session (${n} prompts) — good volume for calibration.`);
  else strengths.push("You completed a focused practice block — use more prompts next time for stronger signal.");
  if (avgA > 400) strengths.push("Answers tended to be detailed; that helps in narrative-heavy loops.");
  else strengths.push("Keep pushing answers toward concrete examples and metrics where possible.");

  const improvementAreas: string[] = [
    "Tighten structure: lead with the direct answer, then layers of depth.",
    "Add one quantified outcome per story (latency, accuracy, revenue, reliability).",
  ];
  if (companyMode === "amazon") {
    improvementAreas.push("Explicitly map examples to Leadership Principles and ownership boundaries.");
  } else if (companyMode === "google") {
    improvementAreas.push("Practice articulating complexity, edge cases, and scalability limits crisply.");
  } else if (companyMode === "razorpay") {
    improvementAreas.push("Call out failure modes: idempotency, reconciliation, and safe rollouts.");
  }

  const templates = [
    `For a ${roleLabel} loop: explain the hardest trade-off you owned end-to-end.`,
    `Walk through a production incident: detection, mitigation, and what you changed permanently.`,
    `Design a system for ${companyMode === "generic" ? "high read traffic" : "your domain"} with clear scaling story.`,
  ];
  const nextPracticeQuestions = templates.slice(0, 3);

  const conciseCoachNote = `Session debrief (${roleLabel}, ${companyMode === "generic" ? "general" : companyMode} bar): anchor each answer with constraints, your decision, and measured impact. Drill the three practice questions aloud with a 90-second timer.`;

  return {
    overallScore: base,
    strengths: strengths.slice(0, 4),
    improvementAreas: improvementAreas.slice(0, 4),
    nextPracticeQuestions,
    conciseCoachNote,
    source: "fallback",
  };
}

function normalizeDebriefPartial(
  partial: Partial<SessionDebrief> | null,
  fallback: SessionDebrief,
): SessionDebrief {
  if (!partial) return fallback;

  const rawScore = Number(partial.overallScore);
  const overallScore = Number.isFinite(rawScore)
    ? clampInt(rawScore, 0, 100)
    : fallback.overallScore;
  let strengths = normalizeStringArray(partial.strengths, 6, 280);
  let improvementAreas = normalizeStringArray(partial.improvementAreas, 6, 280);
  let nextPracticeQuestions = normalizeStringArray(partial.nextPracticeQuestions, 5, 400);
  const note =
    typeof partial.conciseCoachNote === "string" && partial.conciseCoachNote.trim()
      ? partial.conciseCoachNote.trim().slice(0, 1200)
      : fallback.conciseCoachNote;

  if (strengths.length === 0) strengths = fallback.strengths;
  if (improvementAreas.length === 0) improvementAreas = fallback.improvementAreas;
  while (nextPracticeQuestions.length < 3) {
    const idx = nextPracticeQuestions.length;
    nextPracticeQuestions.push(fallback.nextPracticeQuestions[idx] ?? `Practice question ${idx + 1}`);
  }
  nextPracticeQuestions = nextPracticeQuestions.slice(0, 3);

  return {
    overallScore,
    strengths,
    improvementAreas,
    nextPracticeQuestions,
    conciseCoachNote: note,
  };
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlKey = rateLimitKeyForRequest({
    namespace: "session_debrief",
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
  const rawQnas = body.qnas;
  const roleRaw = typeof body.role === "string" ? body.role : "";
  const companyRaw = body.companyMode;

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

  if (!Array.isArray(rawQnas) || rawQnas.length === 0) {
    return NextResponse.json({ error: "Add at least one Q&A pair from this session." }, { status: 400 });
  }
  if (rawQnas.length > MAX_QNA_ITEMS) {
    return NextResponse.json(
      { error: `Too many Q&A items (max ${MAX_QNA_ITEMS}). Export and split the session if needed.` },
      { status: 400 },
    );
  }

  const qnas: { question: string; answer: string }[] = [];
  for (const item of rawQnas) {
    if (!item || typeof item !== "object") continue;
    const q = typeof (item as { question?: unknown }).question === "string"
      ? (item as { question: string }).question.trim()
      : "";
    const a = typeof (item as { answer?: unknown }).answer === "string"
      ? (item as { answer: string }).answer.trim()
      : "";
    if (!q || !a) continue;
    qnas.push({
      question: q.slice(0, MAX_QUESTION_LEN),
      answer: a.slice(0, MAX_ANSWER_LEN),
    });
  }

  if (qnas.length === 0) {
    return NextResponse.json({ error: "Each Q&A needs non-empty question and answer text." }, { status: 400 });
  }

  const fallback = buildFallbackDebrief({ role, companyMode, qnas });
  const companyLine = COMPANY_DEBRIEF_CONTEXT[companyMode] ?? COMPANY_DEBRIEF_CONTEXT.generic;
  const transcript = qnas
    .map((pair, i) => `---\nQ${i + 1}: ${pair.question}\nA${i + 1}: ${pair.answer}`)
    .join("\n")
    .slice(0, 24_000);

  const systemPreamble = `You are an interview coach. Return ONLY valid JSON (no markdown fences) with this shape:
{"overallScore":number,"strengths":string[],"improvementAreas":string[],"nextPracticeQuestions":string[],"conciseCoachNote":string"}
Rules: overallScore integer 0-100; strengths 2-4 items; improvementAreas 2-4 items; nextPracticeQuestions exactly 3 short questions tailored to the role; conciseCoachNote max 2 sentences, actionable.`;

  const userContent = `Role: ${ROLE_LABELS[role] ?? role}
Company bar: ${companyLine}

Session transcript:
${transcript}`;

  const fullPrompt = `${systemPreamble}\n\n${userContent}`;

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GOOGLE_AI_KEY;

  let source: SessionDebrief["source"] = "fallback";
  let merged = fallback;

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
          max_tokens: 700,
          temperature: 0.4,
        }),
      });
      if (res.ok) {
        const data = await withTimeout(res.json(), 12_000);
        const text = data.choices?.[0]?.message?.content as string | undefined;
        if (text) {
          const parsed = parseDebriefJson(text);
          if (parsed) {
            merged = normalizeDebriefPartial(parsed, fallback);
            source = "openrouter";
          }
        }
      }
    } catch {
      merged = fallback;
      source = "fallback";
    }
  }

  if (source === "fallback" && geminiKey) {
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
        const data = await withTimeout(res.json(), 12_000);
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
        if (text) {
          const parsed = parseDebriefJson(text);
          if (parsed) {
            merged = normalizeDebriefPartial(parsed, fallback);
            source = "gemini";
          }
        }
      }
    } catch {
      merged = fallback;
      source = "fallback";
    }
  }

  const payload: SessionDebrief = { ...merged, source };

  return NextResponse.json(payload);
}
