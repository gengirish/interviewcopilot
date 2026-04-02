import type { NextRequest } from "next/server";

type RateLimitEntry = { count: number; resetAt: number };

function getStore(): Map<string, RateLimitEntry> {
  const g = globalThis as typeof globalThis & {
    __infinityhireApiRateLimitStore?: Map<string, RateLimitEntry>;
  };
  if (!g.__infinityhireApiRateLimitStore) {
    g.__infinityhireApiRateLimitStore = new Map();
  }
  return g.__infinityhireApiRateLimitStore;
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Stable rate-limit key: prefer authenticated user id; fall back to IP for unauthenticated routes.
 */
export function rateLimitKeyForRequest(opts: {
  namespace: string;
  userId: string | null | undefined;
  req: NextRequest;
}): string {
  if (opts.userId) {
    return `${opts.namespace}:user:${opts.userId}`;
  }
  return `${opts.namespace}:ip:${getClientIp(opts.req)}`;
}

export type ConsumeRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Fixed-window counter rate limit (in-memory). Suitable for single-node / dev; use a shared store in production multi-instance.
 */
export function consumeRateLimitToken(params: {
  key: string;
  windowMs: number;
  maxRequests: number;
}): ConsumeRateLimitResult {
  const now = Date.now();
  const store = getStore();
  const entry = store.get(params.key);

  if (!entry || entry.resetAt <= now) {
    store.set(params.key, { count: 1, resetAt: now + params.windowMs });
    return { allowed: true };
  }

  if (entry.count >= params.maxRequests) {
    const retryAfterMs = Math.max(0, entry.resetAt - now);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  entry.count += 1;
  store.set(params.key, entry);
  return { allowed: true };
}
