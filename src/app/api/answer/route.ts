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

  // 1. Try Gemini 2.0 Flash (primary — free tier)
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

  // 2. Fallback: OpenRouter (claude-3-haiku)
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

  // 3. Static fallback — at least make it question-aware
  const roleLabel = (normalizedRole || "engineer").replace(/-/g, " ");
  const isStarQuestion = /tell me about|give me an example|describe a time|when did you/i.test(
    normalizedQuestion
  );
  const isTechnicalQuestion = /how does|what is|explain|difference between|why do/i.test(
    normalizedQuestion
  );

  let answer = "";
  if (isStarQuestion) {
    answer = `As a ${roleLabel}, I faced a similar situation in a recent project.\n\n**Situation:** Our team needed to deliver a critical feature under a tight deadline with limited resources.\n\n**Task:** I was responsible for leading the design and implementation end-to-end.\n\n**Action:** I broke the problem into smaller milestones, prioritised the highest-impact components, and coordinated closely with cross-functional stakeholders to unblock dependencies quickly.\n\n**Result:** We shipped on time, reduced technical debt by 30%, and the solution has been running in production with zero incidents for 6 months.\n\nI'd be happy to dive deeper into any specific aspect of this experience.`;
  } else if (isTechnicalQuestion) {
    answer = `Great technical question. As a ${roleLabel}, this is something I work with regularly.\n\nThe core concept here involves understanding the trade-offs between different approaches. In my experience, the most effective solution depends on your specific constraints — scale, latency requirements, and team familiarity with the technology.\n\nI'd approach this by first defining the requirements clearly, then evaluating 2-3 options against those criteria, and finally implementing with proper testing and monitoring in place.\n\nFor a concrete example from my work: we faced a similar decision and chose the approach that balanced developer productivity with production reliability — which paid off significantly in the long run.`;
  } else {
    answer = `As a ${roleLabel}, I approach this by focusing on first principles and clear communication with stakeholders.\n\nIn my experience, the key is to break complex problems into manageable pieces, align with the team on priorities, and iterate quickly based on feedback.\n\nI've consistently found that combining technical rigour with strong collaboration leads to the best outcomes — and that's the approach I'd bring to this role.`;
  }

  await incrementUsage(user.id);
  if (usageBefore === 0) {
    await trackEvent(user.id, "first_question_asked", { source: "api" });
  }
  return NextResponse.json({ answer, source: "fallback" });
}
