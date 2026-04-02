"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mic,
  BarChart3,
  Zap,
  MessageSquare,
  Calendar,
  Loader2,
  ArrowLeft,
  Target,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  ApiError,
  createCheckoutSession,
  getAnalyticsOverview,
  getAnswerFeedbackSummary,
  upgradeToPro,
} from "@/lib/api";
import type { AnalyticsOverview } from "@/lib/api";
import { SESSIONS_STORAGE_KEY } from "@/lib/types";
import type { AnswerFeedbackSummary, SessionSummary } from "@/lib/types";

function getLocalSessions(): SessionSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SessionSummary =>
        s && typeof s === "object" && typeof s.timestamp === "number" && typeof s.count === "number"
    );
  } catch {
    return [];
  }
}

function getRecentSessionsSummary(sessions: SessionSummary[]): {
  sessionCount: number;
  totalQuestions: number;
} {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = sessions.filter((s) => s.timestamp >= thirtyDaysAgo);
  const totalQuestions = recent.reduce((sum, s) => sum + s.count, 0);
  return { sessionCount: recent.length, totalQuestions };
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [localSessions, setLocalSessions] = useState<SessionSummary[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<AnswerFeedbackSummary | null>(null);

  useEffect(() => {
    getAnalyticsOverview()
      .then(setOverview)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getAnswerFeedbackSummary().then(setFeedbackSummary).catch(() => setFeedbackSummary(null));
  }, []);

  useEffect(() => {
    setLocalSessions(getLocalSessions());
    const onStorage = () => setLocalSessions(getLocalSessions());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const { sessionCount, totalQuestions } = getRecentSessionsSummary(localSessions);

  if (loading) {
    return (
      <main className="min-h-screen bg-neural-bg flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-neural-cyan animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neural-bg">
      <header className="sticky top-0 z-50 border-b border-neural-border bg-neural-bg/90 backdrop-blur-md px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 text-neural-muted hover:text-white transition-colors">
              <Mic className="w-5 h-5 text-neural-cyan" />
              <span className="font-bold text-white">InfinityHire Copilot</span>
            </Link>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neural-surface border border-neural-border text-neural-muted">
              Dashboard
            </span>
          </div>
          <Link
            href="/session"
            className="text-xs text-neural-muted hover:text-white transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Session
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Interview Analytics</h1>

        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total answers this month */}
          <div className="rounded-xl border border-neural-border bg-neural-surface p-5 card-hover">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-neural-cyan" />
              <span className="text-xs font-medium text-neural-muted uppercase tracking-wider">
                Answers this month
              </span>
            </div>
            <p className="text-3xl font-bold text-white">
              {overview?.answersThisMonth ?? 0}
            </p>
          </div>

          {/* Plan */}
          <div className="rounded-xl border border-neural-border bg-neural-surface p-5 card-hover">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-neural-purple" />
              <span className="text-xs font-medium text-neural-muted uppercase tracking-wider">
                Plan
              </span>
            </div>
            <p className="text-2xl font-bold text-white capitalize">
              {overview?.plan ?? "free"}
            </p>
            <p className="text-xs text-neural-muted mt-1">
              {overview?.plan === "pro" ? "Unlimited answers" : `${overview?.monthlyQuota ?? 30} answers/month`}
            </p>
          </div>

          {/* Remaining quota */}
          <div className="rounded-xl border border-neural-border bg-neural-surface p-5 card-hover">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-neural-green" />
              <span className="text-xs font-medium text-neural-muted uppercase tracking-wider">
                Remaining quota
              </span>
            </div>
            <p className="text-3xl font-bold text-white">
              {overview?.remainingQuota ?? 0}
            </p>
            <p className="text-xs text-neural-muted mt-1">
              of {overview?.monthlyQuota === -1 ? "unlimited" : overview?.monthlyQuota ?? 30} this month
            </p>
          </div>

          {/* Recent sessions / questions */}
          <div className="rounded-xl border border-neural-border bg-neural-surface p-5 card-hover">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-neural-cyan" />
              <span className="text-xs font-medium text-neural-muted uppercase tracking-wider">
                Recent (30d)
              </span>
            </div>
            <p className="text-2xl font-bold text-white">
              {sessionCount} sessions
            </p>
            <p className="text-sm text-neural-muted mt-1">
              {totalQuestions} questions total
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-neural-border bg-neural-surface p-5">
          <h2 className="text-lg font-semibold text-white mb-3">Usage summary</h2>
          <p className="text-sm text-neural-muted">
            Answers this month are tracked server-side. Session and question counts come from this device (localStorage).
            Upgrade to Pro for unlimited answers.
          </p>
          {overview?.plan === "free" && (
            <button
              type="button"
              data-testid="dashboard-secure-checkout"
              onClick={async () => {
                setError(null);
                setUpgrading(true);
                try {
                  const { checkoutUrl } = await createCheckoutSession();
                  window.location.assign(checkoutUrl);
                } catch (e) {
                  // 503 = billing not configured (or unavailable). Try mock upgrade when allowed (dev / ALLOW_MOCK_UPGRADE).
                  const billingNotReady = e instanceof ApiError && e.status === 503;
                  if (billingNotReady) {
                    try {
                      await upgradeToPro();
                      const refreshed = await getAnalyticsOverview();
                      setOverview(refreshed);
                    } catch (inner) {
                      setError(inner instanceof Error ? inner.message : "Upgrade failed");
                    }
                  } else {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Checkout is unavailable. Try again or contact support.",
                    );
                  }
                } finally {
                  setUpgrading(false);
                }
              }}
              disabled={upgrading}
              className="mt-4 rounded-lg bg-neural-cyan px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {upgrading ? "Starting checkout…" : "Secure checkout"}
            </button>
          )}
        </div>

        <div className="rounded-xl border border-neural-border bg-neural-surface p-5 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-neural-cyan" />
            <h2 className="text-lg font-semibold text-white">Activation score</h2>
          </div>
          <p className="text-sm text-neural-muted mb-3">
            Tracks your progress through key product milestones.
          </p>
          <p className="text-3xl font-bold text-white mb-3">
            {overview?.activation?.score ?? 0}%
          </p>
          <div className="text-sm text-neural-muted space-y-1">
            <p>
              Completed:{" "}
              <span className="text-white">
                {overview?.activation?.completed?.length ?? 0}
              </span>
            </p>
            <p>
              Remaining:{" "}
              <span className="text-white">
                {overview?.activation?.pending?.length ?? 0}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-neural-border bg-neural-surface p-5 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <ThumbsUp className="w-5 h-5 text-neural-cyan" />
            <h2 className="text-lg font-semibold text-white">Interview quality score</h2>
          </div>
          <p className="text-sm text-neural-muted mb-3">
            Uses your helpful/not-helpful feedback to track answer quality and guide improvements.
          </p>
          <p className="text-3xl font-bold text-white mb-3">
            {feedbackSummary?.score === null || feedbackSummary?.score === undefined
              ? "--"
              : `${feedbackSummary.score}%`}
          </p>
          <div className="text-sm text-neural-muted space-y-1">
            <p>
              Helpful votes:{" "}
              <span className="text-white">
                {feedbackSummary?.up ?? 0}
              </span>
            </p>
            <p>
              Not helpful votes:{" "}
              <span className="text-white">
                {feedbackSummary?.down ?? 0}
              </span>
            </p>
            <p>
              Total ratings this month:{" "}
              <span className="text-white">
                {feedbackSummary?.total ?? 0}
              </span>
            </p>
          </div>
          {(feedbackSummary?.total ?? 0) === 0 && (
            <p className="text-xs text-neural-muted mt-3">
              Rate answers in session to unlock a personalized quality score.
            </p>
          )}
          <Link
            href="/session"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-neural-cyan/40 px-3 py-2 text-xs font-semibold text-neural-cyan hover:bg-neural-cyan/10 transition-colors"
          >
            Improve score in next session
          </Link>
        </div>
      </div>
    </main>
  );
}
