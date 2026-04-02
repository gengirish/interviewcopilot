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
  Users,
  Share2,
  ClipboardList,
  Copy,
  Check,
} from "lucide-react";
import {
  ApiError,
  createCheckoutSession,
  generateSessionPrepPlan,
  getAnalyticsOverview,
  getAnswerFeedbackSummary,
  toUserMessage,
  upgradeToPro,
} from "@/lib/api";
import type { AnalyticsOverview } from "@/lib/api";
import {
  LAST_SESSION_DEBRIEF_STORAGE_KEY,
  SESSIONS_STORAGE_KEY,
} from "@/lib/types";
import type {
  AnswerFeedbackSummary,
  CompanyMode,
  Role,
  SessionDebrief,
  SessionPrepPlanResponse,
  SessionSummary,
} from "@/lib/types";

const PREP_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "ml-engineer", label: "ML / AI Engineer" },
  { value: "data-scientist", label: "Data Scientist" },
  { value: "ai-architect", label: "AI Solutions Architect" },
  { value: "backend", label: "Backend Engineer" },
  { value: "fullstack", label: "Full-Stack Engineer" },
  { value: "product", label: "Product Manager" },
];

const PREP_COMPANY_OPTIONS: { value: CompanyMode; label: string }[] = [
  { value: "generic", label: "General (default)" },
  { value: "google", label: "Google" },
  { value: "amazon", label: "Amazon" },
  { value: "razorpay", label: "Razorpay" },
  { value: "atlassian", label: "Atlassian" },
  { value: "flipkart", label: "Flipkart" },
];

const VALID_PREP_ROLES = new Set(PREP_ROLE_OPTIONS.map((r) => r.value));
const VALID_PREP_COMPANY = new Set(PREP_COMPANY_OPTIONS.map((c) => c.value));

function linesFromTextarea(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatPrepPlanForCopy(plan: SessionPrepPlanResponse): string {
  const lines: string[] = ["InfinityHire Copilot — 7-day prep plan", "", plan.summary, ""];
  for (const d of plan.days) {
    lines.push(`Day ${d.day}`, `Goal: ${d.goal}`, "Drills:");
    for (const drill of d.drills) lines.push(`- ${drill}`);
    lines.push(`Expected outcome: ${d.expectedOutcome}`, "");
  }
  return lines.join("\n");
}

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
  const [prepRole, setPrepRole] = useState<Role>("ml-engineer");
  const [prepCompany, setPrepCompany] = useState<CompanyMode>("generic");
  const [prepFocusText, setPrepFocusText] = useState("");
  const [prepImprovementText, setPrepImprovementText] = useState("");
  const [prepCoachNote, setPrepCoachNote] = useState("");
  const [prepPlan, setPrepPlan] = useState<SessionPrepPlanResponse | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [prepCopied, setPrepCopied] = useState(false);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_SESSION_DEBRIEF_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      let debrief: SessionDebrief | null = null;
      let storedRole: Role | undefined;
      let storedCompany: CompanyMode | undefined;
      if (parsed && typeof parsed === "object" && parsed !== null && "debrief" in parsed) {
        const w = parsed as { debrief?: SessionDebrief; role?: string; companyMode?: string };
        debrief = w.debrief ?? null;
        if (typeof w.role === "string" && VALID_PREP_ROLES.has(w.role as Role)) {
          storedRole = w.role as Role;
        }
        if (typeof w.companyMode === "string" && VALID_PREP_COMPANY.has(w.companyMode as CompanyMode)) {
          storedCompany = w.companyMode as CompanyMode;
        }
      } else if (parsed && typeof parsed === "object" && parsed !== null) {
        debrief = parsed as SessionDebrief;
      }
      if (!debrief) return;
      if (storedRole) setPrepRole(storedRole);
      if (storedCompany) setPrepCompany(storedCompany);
      if (debrief.improvementAreas?.length) {
        setPrepImprovementText(debrief.improvementAreas.join("\n"));
      }
      if (debrief.conciseCoachNote) {
        setPrepCoachNote(debrief.conciseCoachNote);
      }
    } catch {
      /* ignore */
    }
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
          <div className="flex items-center gap-3">
            <Link
              href="/team"
              className="text-xs text-neural-muted hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <Users className="w-3 h-3" /> Team panel
            </Link>
            <Link
              href="/session"
              className="text-xs text-neural-muted hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Session
            </Link>
          </div>
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

        <div className="rounded-xl border border-neural-border bg-neural-surface p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Share2 className="w-5 h-5 text-neural-cyan" />
            <h2 className="text-lg font-semibold text-white">Team debrief & sharing</h2>
          </div>
          <p className="text-sm text-neural-muted mb-4 leading-relaxed">
            Run a quick panel rubric after interviews, or paste a shareable practice summary to mentors and peers.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/team"
              className="inline-flex items-center gap-2 rounded-lg border border-neural-purple/40 bg-neural-purple/15 px-4 py-2 text-xs font-semibold text-white hover:bg-neural-purple/25 transition-colors"
            >
              <Users className="w-4 h-4 text-neural-cyan" />
              Open team panel
            </Link>
            <Link
              href="/session"
              className="inline-flex items-center gap-2 rounded-lg border border-neural-cyan/40 px-4 py-2 text-xs font-semibold text-neural-cyan hover:bg-neural-cyan/10 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Session — shareable report after debrief
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-neural-border bg-neural-surface p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-neural-cyan" />
            <h2 className="text-lg font-semibold text-white">7-day prep plan</h2>
          </div>
          <p className="text-sm text-neural-muted mb-4 leading-relaxed">
            Turn debrief takeaways and your focus areas into a week of drills. Fields pre-fill from your last session
            debrief when you generate one in session.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <label className="block text-xs text-neural-muted">
              Role
              <select
                value={prepRole}
                onChange={(e) => setPrepRole(e.target.value as Role)}
                className="mt-1 w-full rounded-lg border border-neural-border bg-neural-bg px-3 py-2 text-sm text-white"
              >
                {PREP_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-neural-muted">
              Company interview bar
              <select
                value={prepCompany}
                onChange={(e) => setPrepCompany(e.target.value as CompanyMode)}
                className="mt-1 w-full rounded-lg border border-neural-border bg-neural-bg px-3 py-2 text-sm text-white"
              >
                {PREP_COMPANY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs text-neural-muted mb-3">
            Focus areas (optional, one per line)
            <textarea
              value={prepFocusText}
              onChange={(e) => setPrepFocusText(e.target.value)}
              rows={3}
              placeholder={"e.g. system design under pressure\nshorter answers with metrics"}
              className="mt-1 w-full rounded-lg border border-neural-border bg-neural-bg px-3 py-2 text-sm text-white placeholder:text-neural-muted/60"
            />
          </label>
          <label className="block text-xs text-neural-muted mb-3">
            Debrief improvement areas (optional, one per line)
            <textarea
              value={prepImprovementText}
              onChange={(e) => setPrepImprovementText(e.target.value)}
              rows={3}
              placeholder="Pasted from debrief or your own notes"
              className="mt-1 w-full rounded-lg border border-neural-border bg-neural-bg px-3 py-2 text-sm text-white placeholder:text-neural-muted/60"
            />
          </label>
          <label className="block text-xs text-neural-muted mb-4">
            Coach note from debrief (optional)
            <textarea
              value={prepCoachNote}
              onChange={(e) => setPrepCoachNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-neural-border bg-neural-bg px-3 py-2 text-sm text-white placeholder:text-neural-muted/60"
            />
          </label>
          <button
            type="button"
            data-testid="dashboard-generate-prep-plan"
            disabled={prepLoading}
            onClick={async () => {
              setPrepError(null);
              setPrepLoading(true);
              setPrepPlan(null);
              try {
                const focusAreas = linesFromTextarea(prepFocusText);
                const improvementLines = linesFromTextarea(prepImprovementText);
                const debriefPartial =
                  improvementLines.length > 0 || prepCoachNote.trim().length > 0
                    ? {
                        ...(improvementLines.length > 0 ? { improvementAreas: improvementLines } : {}),
                        ...(prepCoachNote.trim() ? { conciseCoachNote: prepCoachNote.trim() } : {}),
                      }
                    : undefined;
                const plan = await generateSessionPrepPlan({
                  role: prepRole,
                  companyMode: prepCompany,
                  focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
                  debrief: debriefPartial,
                });
                setPrepPlan(plan);
              } catch (e) {
                setPrepError(toUserMessage(e, "Could not generate prep plan."));
              } finally {
                setPrepLoading(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-neural-cyan px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {prepLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generating…
              </>
            ) : (
              "Generate 7-day prep plan"
            )}
          </button>
          {prepError && (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {prepError}
            </p>
          )}
          {prepPlan && (
            <div data-testid="prep-plan-results" className="mt-6 space-y-4 border-t border-neural-border pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Your plan</p>
                <button
                  type="button"
                  data-testid="dashboard-copy-prep-plan"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(formatPrepPlanForCopy(prepPlan));
                      setPrepCopied(true);
                      window.setTimeout(() => setPrepCopied(false), 2000);
                    } catch {
                      setPrepError("Could not copy to clipboard.");
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-neural-border px-3 py-1.5 text-xs font-semibold text-neural-muted hover:text-white hover:border-neural-cyan/40 transition-colors"
                >
                  {prepCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-neural-green" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy plan
                    </>
                  )}
                </button>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">{prepPlan.summary}</p>
              <ol className="space-y-4 list-none p-0 m-0">
                {prepPlan.days.map((d) => (
                  <li
                    key={d.day}
                    className="rounded-lg border border-neural-cyan/15 bg-neural-bg/60 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-neural-cyan mb-1">
                      Day {d.day}
                    </p>
                    <p className="text-sm font-medium text-white mb-2">{d.goal}</p>
                    <ul className="list-disc list-inside text-sm text-neural-muted space-y-1 mb-2">
                      {d.drills.map((drill, i) => (
                        <li key={i}>{drill}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-slate-300">
                      <span className="text-neural-muted">Expected: </span>
                      {d.expectedOutcome}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
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
