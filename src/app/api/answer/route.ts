import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { getPlan } from "@/lib/server/user-store";
import { canUseAnswer, getUsage, incrementUsage } from "@/lib/server/usage-store";
import { getPlanLimit } from "@/lib/server/plans";
import { trackEvent } from "@/lib/server/event-store";

const ROLE_PERSONAS: Record<string, string> = {
  "ml-engineer": "You are an expert ML/AI Engineer with 5+ years experience in PyTorch, TensorFlow, transformers, LLMs, RAG, fine-tuning, MLOps, and model deployment.",
  "data-scientist": "You are a senior Data Scientist with expertise in Python, SQL, statistical modelling, A/B testing, pandas, sklearn, and business analytics.",
  "ai-architect": "You are an AI Solutions Architect who designs enterprise AI systems using AWS/Azure/GCP, LLM orchestration, vector databases, and AI strategy.",
  "backend": "You are a senior Backend Engineer with expertise in Python/FastAPI, Node.js, databases (PostgreSQL, Redis, MongoDB), microservices, and system design.",
  "fullstack": "You are a full-stack engineer with expertise in React/Next.js, TypeScript, Node.js, REST/GraphQL APIs, and cloud deployment.",
  "product": "You are a senior Product Manager with experience defining AI product roadmaps, working with engineering teams, and driving metrics-based outcomes.",
};

const VALID_ROLES = new Set(Object.keys(ROLE_PERSONAS));
const MAX_QUESTION_LENGTH = 600;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

type RateLimitEntry = { count: number; resetAt: number };

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

function getStore(): Map<string, RateLimitEntry> {
  const g = globalThis as typeof globalThis & {
    __infinityhireRateLimitStore?: Map<string, RateLimitEntry>;
  };
  if (!g.__infinityhireRateLimitStore) {
    g.__infinityhireRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return g.__infinityhireRateLimitStore;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const store = getStore();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  entry.count += 1;
  store.set(key, entry);
  return true;
}

function extractQuestionKeywords(question: string): string[] {
  const stopwords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "have",
    "what",
    "how",
    "when",
    "where",
    "why",
    "would",
    "should",
    "could",
    "about",
    "into",
    "your",
    "you",
    "are",
    "was",
    "were",
    "can",
    "tell",
    "explain",
    "describe",
    "give",
    "between",
  ]);

  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopwords.has(w));

  return Array.from(new Set(words)).slice(0, 4);
}

function buildQuestionAwareFallback(question: string, roleLabel: string, isStarQuestion: boolean): string {
  const keywords = extractQuestionKeywords(question);
  const focus = keywords.length ? keywords.join(", ") : "the core trade-offs and practical implementation details";

  if (isStarQuestion) {
    return `For "${question}", I would answer in STAR format tailored to a ${roleLabel} context.

Situation: In a recent project, we had a high-impact problem related to ${focus}, under tight delivery constraints.

Task: I owned the outcome end-to-end: define a reliable approach, align stakeholders, and deliver measurable impact.

Action: I clarified requirements, broke the work into milestones, implemented the highest-risk pieces first, and added monitoring so we could validate outcomes quickly and de-risk rollout.

Result: We shipped on schedule, improved reliability and performance, and created a repeatable approach the team could scale.

If useful, I can now give a shorter 30-second version for live interview delivery.`;
  }

  return `For "${question}", my approach as a ${roleLabel} is:

1) Clarify constraints: define scale, latency, reliability, and cost requirements specific to ${focus}.
2) Evaluate options: compare 2-3 approaches with explicit trade-offs, then choose the one with best long-term operability.
3) Implement safely: ship incrementally with tests, observability, and rollback controls.
4) Validate impact: track technical and business metrics, then iterate based on production feedback.

In interviews, I usually anchor this with one concrete project example so the answer is practical, not theoretical.`;
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

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const allowed = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const { question, role, resumeText } = await req.json().catch(() => ({}));
  const normalizedQuestion = typeof question === "string" ? question.trim() : "";
  const normalizedRole = typeof role === "string" ? role : "backend";
  const safeResumeText = typeof resumeText === "string" ? resumeText : "";

  if (!normalizedQuestion) {
    return NextResponse.json({ error: "No question provided" }, { status: 400 });
  }
  if (normalizedQuestion.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Question is too long. Keep it under ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (!VALID_ROLES.has(normalizedRole)) {
    return NextResponse.json({ error: "Invalid role selected." }, { status: 400 });
  }

  // Billing: enforce quota before generation
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const plan = await getPlan(user.id);
  const usageBefore = await getUsage(user.id);
  const limit = getPlanLimit(plan);
  const allowedByPlan = await canUseAnswer(user.id, limit);
  if (!allowedByPlan) {
    return NextResponse.json(
      {
        error: "Monthly answer limit reached. Upgrade to Pro for unlimited answers.",
      },
      { status: 403 }
    );
  }

  const geminiKey = process.env.GOOGLE_AI_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const persona = ROLE_PERSONAS[normalizedRole] || ROLE_PERSONAS["backend"];

  const resumeContext = safeResumeText
    ? `\n\nCandidate resume/background:\n${safeResumeText.slice(0, 2000)}`
    : "";

  const fullPrompt = `${persona}

You are helping a candidate answer interview questions in real time.${resumeContext}

Rules:
- Answer concisely but completely (150-250 words max)
- For behavioural questions (tell me about, give an example), use STAR format: Situation → Task → Action → Result
- For technical questions, give direct, specific answers with examples
- Reference the candidate's resume/background when relevant
- Be confident and professional — this is a live interview
- Start the answer directly — no preamble like "Great question!"

Interview question: "${normalizedQuestion}"`;

  // 1. Try OpenRouter first (primary provider)
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
          max_tokens: 400,
          temperature: 0.7,
        }),
      });
      if (res.ok) {
        const data = await withTimeout(res.json(), 10_000);
        const answer = data.choices?.[0]?.message?.content;
        if (answer) {
          await incrementUsage(user.id);
          if (usageBefore === 0) {
            await trackEvent(user.id, "first_question_asked", { source: "api" });
          }
          return NextResponse.json({ answer, source: "openrouter" });
        }
      }
    } catch {}
  }

  // 2. Fallback: Gemini 2.0 Flash
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
        }
      );
      if (res.ok) {
        const data = await withTimeout(res.json(), 10_000);
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (answer) {
          await incrementUsage(user.id);
          if (usageBefore === 0) {
            await trackEvent(user.id, "first_question_asked", { source: "api" });
          }
          return NextResponse.json({ answer, source: "gemini" });
        }
      }
    } catch {}
  }

  // 3. Static fallback — at least make it question-aware
  const roleLabel = (normalizedRole || "engineer").replace(/-/g, " ");
  const isStarQuestion = /tell me about|give me an example|describe a time|when did you/i.test(
    normalizedQuestion
  );
  const answer = buildQuestionAwareFallback(normalizedQuestion, roleLabel, isStarQuestion);

  await incrementUsage(user.id);
  if (usageBefore === 0) {
    await trackEvent(user.id, "first_question_asked", { source: "api" });
  }
  return NextResponse.json({ answer, source: "fallback" });
}
