import { NextRequest, NextResponse } from "next/server";

const ROLE_PERSONAS: Record<string, string> = {
  "ml-engineer": "You are an expert ML/AI Engineer with 5+ years experience in PyTorch, TensorFlow, transformers, LLMs, RAG, fine-tuning, MLOps, and model deployment.",
  "data-scientist": "You are a senior Data Scientist with expertise in Python, SQL, statistical modelling, A/B testing, pandas, sklearn, and business analytics.",
  "ai-architect": "You are an AI Solutions Architect who designs enterprise AI systems using AWS/Azure/GCP, LLM orchestration, vector databases, and AI strategy.",
  "backend": "You are a senior Backend Engineer with expertise in Python/FastAPI, Node.js, databases (PostgreSQL, Redis, MongoDB), microservices, and system design.",
  "fullstack": "You are a full-stack engineer with expertise in React/Next.js, TypeScript, Node.js, REST/GraphQL APIs, and cloud deployment.",
  "product": "You are a senior Product Manager with experience defining AI product roadmaps, working with engineering teams, and driving metrics-based outcomes.",
};

export async function POST(req: NextRequest) {
  const { question, role, resumeText } = await req.json().catch(() => ({}));

  if (!question) return NextResponse.json({ error: "No question provided" }, { status: 400 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  const persona = ROLE_PERSONAS[role] || ROLE_PERSONAS["backend"];

  const resumeContext = resumeText
    ? `\n\nMy resume/background:\n${resumeText.slice(0, 2000)}`
    : "";

  const systemPrompt = `${persona}

You are helping a candidate answer interview questions in real time.${resumeContext}

Rules:
- Answer concisely but completely (150-250 words max)
- For behavioural questions (tell me about, give an example), use STAR format: Situation → Task → Action → Result
- For technical questions, give direct, specific answers with examples
- Reference the candidate's resume/background when relevant
- Be confident and professional — this is a live interview
- Start the answer directly — no preamble like "Great question!"`;

  // Fallback if no API key
  if (!apiKey || apiKey === "sk-or-v1-xxx") {
    const fallbacks: Record<string, string> = {
      default: `Thank you for that question. Based on my experience as a ${role.replace("-", " ")}, I've worked extensively in this area.\n\nSituation: In my previous role, I faced a similar challenge where we needed to deliver results under tight constraints.\n\nTask: I was responsible for architecting and implementing the solution end-to-end.\n\nAction: I broke the problem down, prioritised the highest-impact components, and collaborated closely with the team to ship iteratively.\n\nResult: We delivered on time, improved performance by 40%, and the solution is still in production.\n\nI'd be happy to dive deeper into any specific aspect of this.`,
    };
    return NextResponse.json({ answer: fallbacks.default, fallback: true });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://interview.intelliforge.digital",
        "X-Title": "InterviewCopilot — IntelliForge AI",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Interview question: "${question}"` },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || "Could not generate answer.";
    return NextResponse.json({ answer });
  } catch (err) {
    return NextResponse.json({ answer: "Network error. Please try again.", error: true });
  }
}
