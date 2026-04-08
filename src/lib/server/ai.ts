/**
 * Centralized AI provider cascade.
 *
 * Provider order: Gemini → OpenRouter → (caller-supplied fallback).
 * Each provider is skipped when its API key env var is unset.
 * All calls enforce a per-request timeout.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

// ── env helpers ────────────────────────────────────────────────────────────────

function geminiConfig() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return key ? { key, model } : null;
}

function openrouterConfig() {
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-haiku";
  return key ? { key, model } : null;
}

// ── timeout wrapper ────────────────────────────────────────────────────────────

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── provider call implementations ──────────────────────────────────────────────

async function callGemini(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number; timeoutMs: number },
): Promise<string | null> {
  const cfg = geminiConfig();
  if (!cfg) return null;

  try {
    const res = await withTimeout(
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
              ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
            },
          }),
        },
      ),
      opts.timeoutMs,
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[ai][gemini] HTTP ${res.status}: ${errBody.slice(0, 500)}`);
      return null;
    }
    const data = await withTimeout(res.json(), 10_000);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    if (!text) {
      console.error("[ai][gemini] no content:", JSON.stringify(data).slice(0, 500));
      return null;
    }
    return text;
  } catch (err) {
    console.error("[ai][gemini] error:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function callOpenAICompatible(
  provider: { name: string; key: string; base: string; model: string },
  prompt: string,
  opts: { maxTokens?: number; temperature?: number; timeoutMs: number },
): Promise<string | null> {
  try {
    const res = await withTimeout(
      fetch(`${provider.base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://infinityhire.ai",
          "X-Title": "InfinityHire Copilot",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: prompt }],
          ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        }),
      }),
      opts.timeoutMs,
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[ai][${provider.name}] HTTP ${res.status}: ${errBody.slice(0, 500)}`);
      return null;
    }
    const data = await withTimeout(res.json(), 10_000);
    const text = data.choices?.[0]?.message?.content as string | undefined;
    if (!text) {
      console.error(`[ai][${provider.name}] no content:`, JSON.stringify(data).slice(0, 500));
      return null;
    }
    return text;
  } catch (err) {
    console.error(`[ai][${provider.name}] error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ── public API ─────────────────────────────────────────────────────────────────

export interface GenerateTextOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface GenerateTextResult {
  text: string;
  source: "gemini" | "openrouter" | "fallback";
}

/**
 * Generate text by cascading through configured AI providers.
 * Returns the first successful response, or null if all providers fail.
 */
export async function generateText(
  prompt: string,
  opts: GenerateTextOptions = {},
): Promise<GenerateTextResult | null> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // 1. Gemini (primary)
  const geminiText = await callGemini(prompt, { ...opts, timeoutMs });
  if (geminiText) return { text: geminiText, source: "gemini" };

  // 2. OpenRouter (secondary — OpenAI-compatible)
  const or = openrouterConfig();
  if (or) {
    const orText = await callOpenAICompatible(
      { name: "openrouter", key: or.key, base: "https://openrouter.ai/api/v1", model: or.model },
      prompt,
      { ...opts, timeoutMs },
    );
    if (orText) return { text: orText, source: "openrouter" };
  }

  console.warn("[ai] all providers failed for prompt:", prompt.slice(0, 80));
  return null;
}
