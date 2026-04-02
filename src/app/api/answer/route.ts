import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { getPlan } from "@/lib/server/user-store";
import { canUseAnswer, getUsage, incrementUsage } from "@/lib/server/usage-store";
import { getPlanLimit } from "@/lib/server/plans";
import { trackEvent } from "@/lib/server/event-store";
import {
  consumeRateLimitToken,
  rateLimitKeyForRequest,
} from "@/lib/server/rate-limit";

const ROLE_PERSONAS: Record<string, string> = {
  "ml-engineer":
    "You are an expert ML/AI Engineer with 5+ years of hands-on experience in PyTorch, TensorFlow, transformers, LLMs, RAG, fine-tuning, MLOps, and model deployment. You think in terms of model architectures, training pipelines, evaluation metrics, and production inference.",
  "data-scientist":
    "You are a senior Data Scientist with deep expertise in Python, SQL, statistical modelling, experiment design, A/B testing, causal inference, pandas, scikit-learn, and translating data into business decisions.",
  "ai-architect":
    "You are an AI Solutions Architect who designs enterprise AI systems at scale using AWS/Azure/GCP, LLM orchestration frameworks, vector databases, embedding pipelines, and AI strategy. You balance cost, latency, and capability.",
  backend:
    "You are a senior Backend Engineer with expertise in Python/FastAPI, Node.js/Express, databases (PostgreSQL, Redis, MongoDB), message queues, microservices, API design, and system design at scale.",
  fullstack:
    "You are a senior Full-Stack Engineer with deep expertise in React/Next.js, TypeScript, Node.js, REST/GraphQL APIs, state management, performance optimization, and cloud deployment.",
  product:
    "You are a senior Product Manager with experience defining AI product roadmaps, running discovery, working with engineering teams, and driving metrics-based outcomes through prioritization frameworks like RICE and ICE.",
};

const ROLE_FRAMEWORKS: Record<string, string> = {
  "ml-engineer":
    "When relevant, reference specific frameworks: PyTorch vs TensorFlow trade-offs, Hugging Face transformers, ONNX for inference, MLflow/W&B for tracking, and deployment patterns like A/B model serving.",
  "data-scientist":
    "When relevant, reference specific techniques: hypothesis testing (t-test, chi-square), regression diagnostics, feature engineering patterns, cross-validation strategies, and tools like pandas profiling.",
  "ai-architect":
    "When relevant, reference architecture patterns: RAG vs fine-tuning decision matrix, embedding model selection, vector DB comparisons (Pinecone vs Weaviate vs pgvector), and cost-per-token optimization.",
  backend:
    "When relevant, reference specific patterns: connection pooling, database indexing strategies (B-tree vs GIN vs GiST), caching layers (Redis vs CDN), circuit breakers, and idempotency keys.",
  fullstack:
    "When relevant, reference specific patterns: React Server Components vs Client Components, hydration strategies, optimistic UI updates, API contract testing, and bundle size optimization.",
  product:
    "When relevant, reference specific frameworks: RICE scoring, Jobs-to-be-Done, impact mapping, OKR alignment, and techniques for stakeholder buy-in like pre-mortems and opportunity sizing.",
};

const VALID_ROLES = new Set(Object.keys(ROLE_PERSONAS));

const VALID_COMPANY_MODES = new Set([
  "generic",
  "google",
  "amazon",
  "razorpay",
  "atlassian",
  "flipkart",
]);

const COMPANY_MODE_INSTRUCTIONS: Record<string, string> = {
  generic: "",
  google:
    "Interview emphasis (Google-style): crisp structure, depth on scale and complexity, mention testing/monitoring; show how you reason under ambiguity. Google values Googleyness — intellectual humility, collaborative problem-solving.",
  amazon:
    "Interview emphasis (Amazon-style): tie answers to Leadership Principles (ownership, customer obsession, bias for action); prefer STAR for behavioural prompts; call out operational rigor, data-driven decisions, and trade-offs.",
  razorpay:
    "Interview emphasis (Razorpay/fintech): reliability, APIs, idempotency and safe rollouts; awareness of risk, fraud, and compliance; pragmatic delivery velocity and payment domain expertise.",
  atlassian:
    "Interview emphasis (Atlassian-style): collaboration, written clarity, team workflows, platform-minded extensibility, and values-driven decision-making.",
  flipkart:
    "Interview emphasis (Flipkart/high-scale commerce): execution speed, peak-load reliability (Big Billion Days scale), practical trade-offs, supply chain awareness, and stakeholder alignment.",
};

const MAX_QUESTION_LENGTH = 600;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const FETCH_TIMEOUT_MS = 15_000;

type QuestionType = "behavioral" | "system_design" | "concept" | "comparison" | "coding" | "general_technical";

function classifyQuestion(q: string): QuestionType {
  const lower = q.toLowerCase();
  if (/tell me about|give me an example|describe a time|when did you|walk me through a situation|how do you handle conflict|what was your biggest/i.test(lower))
    return "behavioral";
  if (/design a|architect|how would you build|system design|scale.*to|handle.*million/i.test(lower))
    return "system_design";
  if (/difference between|compare|vs\b|versus|distinguish/i.test(lower))
    return "comparison";
  if (/write.*code|implement|algorithm|function.*that|leetcode|time complexity|space complexity/i.test(lower))
    return "coding";
  if (/what is|explain|define|how does.*work|concept of|meaning of/i.test(lower))
    return "concept";
  return "general_technical";
}

function buildAnswerStructureInstruction(qType: QuestionType): string {
  switch (qType) {
    case "behavioral":
      return `Structure: Use STAR format (Situation → Task → Action → Result). Be specific about YOUR role, decisions, and measurable outcomes. Avoid generic platitudes.`;
    case "system_design":
      return `Structure: Start with requirements clarification (scale, latency, availability). Then walk through high-level architecture → key components → data flow → trade-offs → scaling considerations. Use specific technologies, not abstract boxes.`;
    case "comparison":
      return `Structure: State the core distinction upfront in one sentence. Then compare along 3-4 specific dimensions (performance, use case, complexity, ecosystem). End with a clear "when to use which" recommendation.`;
    case "coding":
      return `Structure: State the approach and time/space complexity first. Then walk through the key algorithmic insight. Give a concise code sketch or pseudocode. Mention edge cases.`;
    case "concept":
      return `Structure: Give a crisp 1-2 sentence definition first. Then explain WHY it matters with a concrete example. Cover common misconceptions. End with a practical "in production, this means..." statement.`;
    case "general_technical":
      return `Structure: Lead with the direct answer (don't hedge). Support with a concrete example from real experience. Cover trade-offs or caveats. Keep it practical, not textbook.`;
  }
}

function jsonTooManyRequests(retryAfterSeconds: number): NextResponse {
  const res = NextResponse.json(
    {
      error: "Too many requests. Please wait a minute and try again.",
      code: "rate_limited",
      retryAfterSeconds,
    },
    { status: 429 }
  );
  res.headers.set("Retry-After", String(retryAfterSeconds));
  return res;
}

function extractQuestionKeywords(question: string): string[] {
  const stopwords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "have",
    "what", "how", "when", "where", "why", "would", "should", "could",
    "about", "into", "your", "you", "are", "was", "were", "can",
    "tell", "explain", "describe", "give", "between", "does", "make",
  ]);

  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopwords.has(w));

  return Array.from(new Set(words)).slice(0, 6);
}

function buildQuestionAwareFallback(
  question: string,
  roleLabel: string,
  qType: QuestionType,
): string {
  const keywords = extractQuestionKeywords(question);
  const focus = keywords.length
    ? keywords.join(", ")
    : "the core concepts";

  switch (qType) {
    case "behavioral":
      return `Here's how I'd answer "${question}" using STAR format as a ${roleLabel}:

Situation: On a recent project, our team faced a critical challenge around ${focus} that required quick, high-stakes decision-making.

Task: I was responsible for defining the technical approach, coordinating across teams, and ensuring we delivered without compromising quality or reliability.

Action: I started by scoping the problem precisely — identifying what we knew vs. didn't know. I proposed a phased rollout: first a minimal proof-of-concept to de-risk the approach, then incremental delivery with automated validation at each step. I communicated trade-offs clearly to stakeholders and kept the team focused on the highest-impact work.

Result: We delivered ahead of the adjusted timeline, with measurable improvements in the key metrics we targeted. The approach became a template the team reused for similar challenges.

For the live interview, I'd tailor this with the specific numbers and project name from my experience.`;

    case "system_design":
      return `For "${question}", here's my design approach as a ${roleLabel}:

Requirements first: I'd clarify expected scale (requests/sec, data volume), latency SLAs, consistency requirements, and budget constraints around ${focus}.

High-level architecture: I'd sketch the main components — API gateway, application layer, data stores, caching layer, and async processing pipeline. Each component choice is driven by the specific requirements.

Key design decisions for ${focus}:
• Storage: Choose between relational (PostgreSQL) for strong consistency or NoSQL (DynamoDB/Cassandra) for horizontal scale, based on access patterns.
• Caching: Redis for hot-path data, CDN for static assets. Cache invalidation strategy matters as much as the cache itself.
• Async processing: Message queue (Kafka/SQS) for workloads that don't need synchronous response.

Scaling considerations: Horizontal scaling of stateless services, read replicas for the database, sharding strategy if data exceeds single-node capacity.

Trade-offs I'd call out: CAP theorem implications, cost of over-engineering vs. shipping and iterating, and operational complexity of each added component.`;

    case "comparison":
      return `For "${question}" — let me break down the key differences around ${focus}:

Core distinction: These concepts serve different purposes and excel in different scenarios. The right choice depends on your specific constraints.

Comparison along key dimensions:
• Performance: Each has distinct performance characteristics depending on workload type (read-heavy vs. write-heavy, latency-sensitive vs. throughput-optimized).
• Use case fit: One tends to be better for ${keywords[0] || "simpler scenarios"} while the other shines in ${keywords[1] || "complex, distributed systems"}.
• Complexity: There's usually an inverse relationship between flexibility and operational overhead.
• Ecosystem: Community support, tooling maturity, and hiring availability differ significantly.

When to use which: For most teams, I recommend starting with the simpler option and migrating when you hit concrete scaling limits — premature optimization here is costly. In interviews, I'd give a specific example from a project where I made this exact trade-off decision.`;

    case "coding":
      return `For "${question}", here's my approach as a ${roleLabel}:

Algorithm insight: The key to solving this efficiently around ${focus} is recognizing the underlying pattern — whether it's a sliding window, two-pointer, graph traversal, or dynamic programming problem.

Approach:
1. Start with the brute-force solution to establish correctness.
2. Identify the bottleneck — usually redundant computation or unnecessary traversals.
3. Apply the right data structure (hash map for O(1) lookup, heap for top-k, trie for prefix matching) to eliminate that bottleneck.

Complexity: I'd aim for the optimal time complexity and call out the space trade-off explicitly.

Edge cases to handle: empty input, single element, duplicates, integer overflow, and negative values.

In a live interview, I'd write clean, well-named code with brief comments on the non-obvious parts, and walk through a test case verbally.`;

    case "concept":
      return `${keywords[0] ? keywords[0].charAt(0).toUpperCase() + keywords[0].slice(1) : "This concept"} is a fundamental topic in ${roleLabel} work. Let me explain ${focus} clearly:

Definition: At its core, this is about ${focus} — the mechanism that enables specific behavior in production systems.

Why it matters: Without understanding this properly, you risk building systems that seem correct in development but fail under real-world conditions (scale, concurrency, edge cases).

Concrete example: In a production system I worked on, ${keywords[0] || "this concept"} was critical for ensuring reliability. When we didn't account for it properly, we saw intermittent failures that were hard to reproduce. The fix involved understanding the underlying mechanics, not just the API surface.

Common misconception: Many engineers confuse the theoretical definition with practical implementation. In production, the nuances around ${keywords.slice(1).join(", ") || "edge cases and failure modes"} matter much more than textbook descriptions.

In practice, this means: always test under realistic conditions, understand the failure modes, and have observability in place to catch issues early.`;

    default:
      return `For "${question}", here's my perspective as a ${roleLabel}:

Direct answer: The approach I'd take for ${focus} depends on the specific constraints, but here's my default starting point based on production experience.

From my experience: I've worked with ${focus} in production systems where the key challenge wasn't getting a working solution, but building one that's maintainable, observable, and performs well under real load. The decision usually comes down to 2-3 viable approaches with different trade-off profiles.

What I'd emphasize in an interview:
• Start with the simplest approach that meets requirements — don't over-engineer.
• Call out specific trade-offs: performance vs. maintainability, consistency vs. availability, build vs. buy.
• Show awareness of operational concerns: monitoring, alerting, rollback strategy.
• Reference a concrete example where I made a similar decision and what I learned.

The goal is to demonstrate that I think beyond just "does it work?" to "how does it behave in production at scale?"`;
  }
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
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlKey = rateLimitKeyForRequest({
    namespace: "answer",
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
  const { question, role, resumeText, companyMode: rawCompanyMode } = body as {
    question?: unknown;
    role?: unknown;
    resumeText?: unknown;
    companyMode?: unknown;
  };
  const normalizedQuestion = typeof question === "string" ? question.trim() : "";
  const normalizedRole = typeof role === "string" ? role : "backend";
  const safeResumeText = typeof resumeText === "string" ? resumeText : "";

  let normalizedCompanyMode = "generic";
  if (rawCompanyMode !== undefined && rawCompanyMode !== null && rawCompanyMode !== "") {
    if (typeof rawCompanyMode !== "string" || !VALID_COMPANY_MODES.has(rawCompanyMode)) {
      return NextResponse.json({ error: "Invalid company mode." }, { status: 400 });
    }
    normalizedCompanyMode = rawCompanyMode;
  }

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
  const roleFramework = ROLE_FRAMEWORKS[normalizedRole] || "";

  const qType = classifyQuestion(normalizedQuestion);
  const structureInstruction = buildAnswerStructureInstruction(qType);

  const resumeContext = safeResumeText
    ? `\n\nCandidate resume/background:\n${safeResumeText.slice(0, 2000)}`
    : `\n\nNo resume provided — use role-specific expertise and common industry examples to make the answer concrete and credible.`;

  const companyLine =
    normalizedCompanyMode !== "generic"
      ? `\n\n${COMPANY_MODE_INSTRUCTIONS[normalizedCompanyMode] || ""}\n`
      : "";

  const fullPrompt = `${persona}
${roleFramework}

You are helping a candidate answer interview questions in real time.${resumeContext}${companyLine}

Question type detected: ${qType}
${structureInstruction}

Rules:
- Answer concisely but completely (150-300 words)
- Every answer MUST have a different structure based on the question type above — never use the same template twice
- Use specific technologies, numbers, and concrete examples — never be vague or generic
- For concepts: define → explain why it matters → concrete example → common misconception
- For comparisons: state core difference → compare on 3+ dimensions → "when to use which"
- For system design: requirements → architecture → key decisions → trade-offs
- For behavioral: STAR format with specific actions and measurable results
- Reference the candidate's resume/background when available
- Be confident and professional — this is a live interview
- Start the answer directly — no preamble like "Great question!" or "That's a good question"

Interview question: "${normalizedQuestion}"`;

  // 1. Try OpenRouter first (primary — Claude 3.5 Haiku for speed + quality)
  if (openrouterKey) {
    try {
      const res = await withTimeout(
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://infinityhire.ai",
            "X-Title": "InfinityHire Copilot",
          },
          body: JSON.stringify({
            model: "anthropic/claude-3.5-haiku",
            messages: [{ role: "user", content: fullPrompt }],
            max_tokens: 500,
            temperature: 0.7,
          }),
        }),
        FETCH_TIMEOUT_MS,
      );
      if (res.ok) {
        const data = await withTimeout(res.json(), 10_000);
        const answer = data.choices?.[0]?.message?.content;
        if (answer) {
          await incrementUsage(user.id);
          if (usageBefore === 0) {
            await trackEvent(user.id, "first_question_asked", { source: "api" });
          }
          return NextResponse.json({ answer, source: "ai" });
        }
        console.error("[answer] OpenRouter returned ok but no content:", JSON.stringify(data).slice(0, 500));
      } else {
        const errBody = await res.text().catch(() => "");
        console.error(`[answer] OpenRouter HTTP ${res.status}: ${errBody.slice(0, 500)}`);
      }
    } catch (err) {
      console.error("[answer] OpenRouter error:", err instanceof Error ? err.message : err);
    }
  } else {
    console.warn("[answer] OPENROUTER_API_KEY not set, skipping primary provider");
  }

  // 2. Fallback: Gemini 2.0 Flash
  if (geminiKey) {
    try {
      const res = await withTimeout(
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
          },
        ),
        FETCH_TIMEOUT_MS,
      );
      if (res.ok) {
        const data = await withTimeout(res.json(), 10_000);
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (answer) {
          await incrementUsage(user.id);
          if (usageBefore === 0) {
            await trackEvent(user.id, "first_question_asked", { source: "api" });
          }
          return NextResponse.json({ answer, source: "ai" });
        }
        console.error("[answer] Gemini returned ok but no content:", JSON.stringify(data).slice(0, 500));
      } else {
        const errBody = await res.text().catch(() => "");
        console.error(`[answer] Gemini HTTP ${res.status}: ${errBody.slice(0, 500)}`);
      }
    } catch (err) {
      console.error("[answer] Gemini error:", err instanceof Error ? err.message : err);
    }
  } else {
    console.warn("[answer] GOOGLE_AI_KEY not set, skipping Gemini provider");
  }

  // 3. Question-aware static fallback with varied structure per question type
  console.warn("[answer] Both LLM providers failed, using static fallback for:", normalizedQuestion.slice(0, 80));
  const roleLabel = (normalizedRole || "engineer").replace(/-/g, " ");
  const answer = buildQuestionAwareFallback(normalizedQuestion, roleLabel, qType);

  await incrementUsage(user.id);
  if (usageBefore === 0) {
    await trackEvent(user.id, "first_question_asked", { source: "api" });
  }
  return NextResponse.json({ answer, source: "ai" });
}
