import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { trackEvent } from "@/lib/server/event-store";
import type { CompanyMode, PrepPlanDay, Role, SessionPrepPlanResponse } from "@/lib/types";
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

const MAX_FOCUS_AREAS = 12;
const MAX_FOCUS_LEN = 160;
const MAX_IMPROVEMENT_OR_STRENGTH = 6;
const MAX_ITEM_LEN = 280;
const MAX_COACH_NOTE = 1200;
const MAX_PRACTICE_Q = 5;
const MAX_PRACTICE_LEN = 400;
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

const COMPANY_PREP_CONTEXT: Record<CompanyMode, string> = {
  generic: "General tech interview bar: clarity, depth, trade-offs, and concrete examples.",
  google: "Google-style: structured reasoning, depth on scale and edge cases, measurable impact.",
  amazon: "Amazon-style: Leadership Principles via STAR, ownership, and operational rigor.",
  razorpay: "Razorpay / fintech: reliability, APIs, payments thinking, and safe rollouts.",
  atlassian: "Atlassian-style: collaboration, written clarity, and platform-minded execution.",
  flipkart: "Flipkart / e-commerce: pragmatism, peak-load reliability, and stakeholder alignment.",
};

function jsonTooManyRequests(retryAfterSeconds: number): NextResponse {
  const res = NextResponse.json(
    {
      error: "Too many prep plan requests. Please wait a minute and try again.",
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

function parseFocusAreas(raw: unknown): string[] {
  return normalizeStringArray(raw, MAX_FOCUS_AREAS, MAX_FOCUS_LEN);
}

function parseDebriefPayload(raw: unknown):
  | {
      strengths?: string[];
      improvementAreas?: string[];
      conciseCoachNote?: string;
      nextPracticeQuestions?: string[];
      overallScore?: number;
    }
  | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const strengths = normalizeStringArray(o.strengths, MAX_IMPROVEMENT_OR_STRENGTH, MAX_ITEM_LEN);
  const improvementAreas = normalizeStringArray(
    o.improvementAreas,
    MAX_IMPROVEMENT_OR_STRENGTH,
    MAX_ITEM_LEN,
  );
  const nextPracticeQuestions = normalizeStringArray(
    o.nextPracticeQuestions,
    MAX_PRACTICE_Q,
    MAX_PRACTICE_LEN,
  );
  let conciseCoachNote: string | undefined;
  if (typeof o.conciseCoachNote === "string" && o.conciseCoachNote.trim()) {
    conciseCoachNote = o.conciseCoachNote.trim().slice(0, MAX_COACH_NOTE);
  }
  let overallScore: number | undefined;
  if (typeof o.overallScore === "number" && Number.isFinite(o.overallScore)) {
    overallScore = Math.min(100, Math.max(0, Math.round(o.overallScore)));
  }
  if (
    strengths.length === 0 &&
    improvementAreas.length === 0 &&
    !conciseCoachNote &&
    nextPracticeQuestions.length === 0 &&
    overallScore === undefined
  ) {
    return undefined;
  }
  return {
    strengths: strengths.length ? strengths : undefined,
    improvementAreas: improvementAreas.length ? improvementAreas : undefined,
    conciseCoachNote,
    nextPracticeQuestions: nextPracticeQuestions.length ? nextPracticeQuestions : undefined,
    overallScore,
  };
}

function parsePrepPlanJson(text: string): unknown {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as unknown;
  } catch {
    return null;
  }
}

function themeLine(
  focusAreas: string[],
  debrief:
    | {
        strengths?: string[];
        improvementAreas?: string[];
        conciseCoachNote?: string;
      }
    | undefined,
): string {
  const parts = [
    ...focusAreas.slice(0, 3),
    ...(debrief?.improvementAreas ?? []).slice(0, 2),
  ].filter(Boolean);
  return parts.length ? parts.join("; ") : "core interview signal and crisp storytelling";
}

function buildFallbackPrepPlan(input: {
  role: Role;
  companyMode: CompanyMode;
  focusAreas: string[];
  debrief:
    | {
        strengths?: string[];
        improvementAreas?: string[];
        conciseCoachNote?: string;
        nextPracticeQuestions?: string[];
      }
    | undefined;
}): SessionPrepPlanResponse {
  const { role, companyMode, focusAreas, debrief } = input;
  const roleLabel = ROLE_LABELS[role] ?? role;
  const theme = themeLine(focusAreas, debrief);
  const gap = debrief?.improvementAreas?.[0] ?? focusAreas[0] ?? "structure and concrete examples";
  const strength = debrief?.strengths?.[0] ?? "your recent practice momentum";
  const pq = debrief?.nextPracticeQuestions?.[0] ?? `A hard ${roleLabel} scenario you owned end-to-end`;

  const companyHint =
    companyMode === "amazon"
      ? "Map each story to ownership and customer impact (STAR)."
      : companyMode === "google"
        ? "State assumptions, complexity, and how you would validate at scale."
        : companyMode === "razorpay"
          ? "Call out idempotency, reconciliation, and safe rollbacks."
          : "Keep answers tight: decision, trade-offs, metrics.";

  const days: PrepPlanDay[] = [
    {
      day: 1,
      goal: `Lock themes for your ${roleLabel} loop`,
      drills: [
        `Write 3 bullets on ${theme} you want interviewers to remember.`,
        `List 2 gaps to fix this week (start with: ${gap}).`,
        `Re-read one strength to lean on: ${strength}.`,
      ],
      expectedOutcome: "You have a one-page prep anchor you can reuse daily.",
    },
    {
      day: 2,
      goal: "Upgrade answer structure (first 30 seconds)",
      drills: [
        "Record 3 answers with bottom-line-first openers (90 seconds each).",
        "For each, add: constraints → your decision → metric or lesson learned.",
        companyHint,
      ],
      expectedOutcome: "Openers feel intentional; less rambling under time pressure.",
    },
    {
      day: 3,
      goal: "Deepen technical or domain depth",
      drills: [
        `Whiteboard one real architecture or analysis tied to ${roleLabel} work.`,
        "List 5 edge cases or failure modes and how you'd detect them in prod.",
        "Explain the same idea to a non-expert in 60 seconds.",
      ],
      expectedOutcome: "You can go one level deeper without losing the thread.",
    },
    {
      day: 4,
      goal: "Metrics, impact, and credibility",
      drills: [
        "Add one quantified outcome to two stories (latency, accuracy, revenue, reliability).",
        "Practice: 'What would you measure next quarter if you owned this?'",
        "Trim two answers to under 2 minutes while keeping the metric.",
      ],
      expectedOutcome: "Interviewers hear measurable outcomes, not only activities.",
    },
    {
      day: 5,
      goal: "Behavioral and stakeholder moments",
      drills: [
        "Draft 2 STAR stories: conflict/priority call + a mistake you corrected.",
        "For each, name the stakeholder type (exec, peer, customer) and your communication move.",
        companyHint,
      ],
      expectedOutcome: "You have credible behavioral depth that matches the company bar.",
    },
    {
      day: 6,
      goal: `Targeted repeat on "${gap}"`,
      drills: [
        `Redo two answers specifically improving: ${gap}.`,
        `Drill this question aloud twice: ${pq}.`,
        "Self-score 0–10 on clarity; repeat the lowest-scoring answer once more.",
      ],
      expectedOutcome: "Noticeable lift on your weakest signal area in one sitting.",
    },
    {
      day: 7,
      goal: "Timed mock + confidence check",
      drills: [
        "45-minute mock: 4 prompts mixed (technical + behavioral).",
        "After each prompt, write one sentence: what the interviewer learned.",
        "Cool-down: 3-question flash round (60s each) on your top stories.",
      ],
      expectedOutcome: "You finish the week with stamina, pacing, and a repeatable ritual before interviews.",
    },
  ];

  const summary = `Seven-day ${roleLabel} prep (${companyMode === "generic" ? "general" : companyMode} bar): ${theme}. Days 1–2 build structure, 3–4 deepen substance, 5 adds behavioral signal, 6 hones your top gap, 7 validates under time pressure.`;

  return { days, summary: summary.slice(0, 900) };
}

function normalizeDrills(raw: unknown, fallback: string[]): string[] {
  const arr = normalizeStringArray(raw, 6, 320);
  if (arr.length >= 2) return arr.slice(0, 5);
  const out = [...arr];
  let i = 0;
  while (out.length < 2 && i < fallback.length) {
    if (!out.includes(fallback[i])) out.push(fallback[i]);
    i++;
  }
  while (out.length < 2) {
    out.push("Repeat yesterday's drill with a tighter 90-second timer.");
  }
  return out.slice(0, 5);
}

function normalizeDayPartial(raw: unknown, fallback: PrepPlanDay): PrepPlanDay {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const o = raw as Record<string, unknown>;
  const dayNum =
    typeof o.day === "number" && Number.isFinite(o.day)
      ? Math.min(7, Math.max(1, Math.round(o.day)))
      : fallback.day;
  const goal =
    typeof o.goal === "string" && o.goal.trim()
      ? o.goal.trim().slice(0, 500)
      : fallback.goal;
  const expectedOutcome =
    typeof o.expectedOutcome === "string" && o.expectedOutcome.trim()
      ? o.expectedOutcome.trim().slice(0, 500)
      : fallback.expectedOutcome;
  const drills = normalizeDrills(o.drills, fallback.drills);
  return { day: dayNum, goal, drills, expectedOutcome };
}

function normalizePrepPlanFromLlm(
  parsed: unknown,
  fallback: SessionPrepPlanResponse,
): SessionPrepPlanResponse {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
  const o = parsed as Record<string, unknown>;
  const summary =
    typeof o.summary === "string" && o.summary.trim()
      ? o.summary.trim().slice(0, 900)
      : fallback.summary;

  const rawDays = o.days;
  const byDay = new Map<number, PrepPlanDay>();
  if (Array.isArray(rawDays)) {
    for (const item of rawDays) {
      let fb = fallback.days[0];
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const dn = (item as { day?: unknown }).day;
        if (typeof dn === "number" && Number.isFinite(dn)) {
          const idx = Math.min(6, Math.max(0, Math.round(dn) - 1));
          fb = fallback.days[idx] ?? fallback.days[0];
        }
      }
      const d = normalizeDayPartial(item, fb);
      byDay.set(d.day, d);
    }
  }

  const mergedDays: PrepPlanDay[] = [];
  for (let i = 1; i <= 7; i++) {
    const fb = fallback.days[i - 1] ?? fallback.days[0];
    const got = byDay.get(i);
    mergedDays.push(got ? normalizeDayPartial(got, fb) : fb);
  }

  for (let j = 0; j < 7; j++) {
    mergedDays[j] = { ...mergedDays[j], day: j + 1 };
  }

  const finalSummary = summary.length >= 20 ? summary : fallback.summary;

  return { days: mergedDays, summary: finalSummary };
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlKey = rateLimitKeyForRequest({
    namespace: "session_prep_plan",
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

  const focusAreas = parseFocusAreas(body.focusAreas);
  const debrief = parseDebriefPayload(body.debrief);

  const fallback = buildFallbackPrepPlan({ role, companyMode, focusAreas, debrief });

  const roleLabel = ROLE_LABELS[role] ?? role;
  const companyLine = COMPANY_PREP_CONTEXT[companyMode] ?? COMPANY_PREP_CONTEXT.generic;
  const debriefBlock = debrief
    ? `Debrief context (may be partial):
Strengths: ${(debrief.strengths ?? []).join(" | ") || "n/a"}
Improvement areas: ${(debrief.improvementAreas ?? []).join(" | ") || "n/a"}
Coach note: ${debrief.conciseCoachNote ?? "n/a"}
Practice questions: ${(debrief.nextPracticeQuestions ?? []).join(" | ") || "n/a"}
Score (if any): ${debrief.overallScore ?? "n/a"}`
    : "No structured debrief provided; infer reasonable focus from role and company bar.";

  const focusBlock =
    focusAreas.length > 0
      ? `User focus areas (prioritize these):\n${focusAreas.map((f, i) => `${i + 1}. ${f}`).join("\n")}`
      : "No explicit focus areas; choose sensible defaults for the role.";

  const systemPreamble = `You are an interview coach. Return ONLY valid JSON (no markdown fences) with this exact shape:
{"summary":string,"days":[{"day":number,"goal":string,"drills":string[],"expectedOutcome":string}]}
Rules:
- summary: 2-4 sentences, actionable, max ~600 characters.
- days: exactly 7 objects with day values 1 through 7 (one each).
- Each goal: one clear outcome for that day.
- drills: 2-4 short bullet strings per day (specific, doable in 30-60 min).
- expectedOutcome: one sentence describing what "good" looks like that day.
Tailor everything to the role and company interview bar.`;

  const userContent = `Role: ${roleLabel}
Company bar: ${companyLine}

${focusBlock}

${debriefBlock}`;

  const fullPrompt = `${systemPreamble}\n\n${userContent}`;

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GOOGLE_AI_KEY;

  type PlanSource = "openrouter" | "gemini" | "fallback";
  let source: PlanSource = "fallback";
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
          max_tokens: 1800,
          temperature: 0.45,
        }),
      });
      if (res.ok) {
        const data = await withTimeout(res.json(), 14_000);
        const text = data.choices?.[0]?.message?.content as string | undefined;
        if (text) {
          const parsed = parsePrepPlanJson(text);
          if (parsed) {
            merged = normalizePrepPlanFromLlm(parsed, fallback);
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
        const data = await withTimeout(res.json(), 14_000);
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
        if (text) {
          const parsed = parsePrepPlanJson(text);
          if (parsed) {
            merged = normalizePrepPlanFromLlm(parsed, fallback);
            source = "gemini";
          }
        }
      }
    } catch {
      merged = fallback;
      source = "fallback";
    }
  }

  try {
    await trackEvent(user.id, "prep_plan_generated", { source, role, companyMode });
  } catch {
    // non-fatal
  }

  const payload: SessionPrepPlanResponse = merged;
  return NextResponse.json(payload);
}
