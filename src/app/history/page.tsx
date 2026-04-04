"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mic,
  ChevronDown,
  ChevronRight,
  History,
  BarChart3,
  Play,
  Loader2,
  AlertTriangle,
  Brain,
  Calendar,
} from "lucide-react";
import {
  listServerSessions,
  getServerSession,
  toUserMessage,
} from "@/lib/api";
import type { SessionListItem, SessionQnAItem } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  "ml-engineer": "ML / AI Engineer",
  "data-scientist": "Data Scientist",
  "ai-architect": "AI Solutions Architect",
  backend: "Backend Engineer",
  fullstack: "Full-Stack Engineer",
  product: "Product Manager",
};

function ScoreChart({ sessions }: { sessions: SessionListItem[] }) {
  const scored = sessions
    .filter((s) => s.debriefScore !== null)
    .slice(0, 20)
    .reverse();

  if (scored.length < 2) return null;

  const max = Math.max(...scored.map((s) => s.debriefScore!));
  const min = Math.min(...scored.map((s) => s.debriefScore!));
  const range = max - min || 1;
  const chartH = 120;
  const chartW = 100;

  const points = scored.map((s, i) => {
    const x = (i / (scored.length - 1)) * chartW;
    const y = chartH - ((s.debriefScore! - min) / range) * (chartH - 20) - 10;
    return `${x},${y}`;
  });

  return (
    <div className="rounded-xl border border-neural-border bg-neural-surface p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-neural-cyan" />
        <h2 className="text-sm font-semibold text-white">Debrief Score Trend</h2>
      </div>
      <svg
        viewBox={`-5 0 ${chartW + 10} ${chartH}`}
        className="w-full h-32"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke="rgba(0,212,255,0.5)"
          strokeWidth="2"
          points={points.join(" ")}
        />
        {scored.map((s, i) => {
          const x = (i / (scored.length - 1)) * chartW;
          const y = chartH - ((s.debriefScore! - min) / range) * (chartH - 20) - 10;
          return (
            <circle key={s.id} cx={x} cy={y} r="3" fill="#00d4ff" />
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-neural-muted mt-1">
        <span>{new Date(scored[0].startedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
        <span>{new Date(scored[scored.length - 1].startedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
      </div>
    </div>
  );
}

function SessionRow({
  session,
  isExpanded,
  onToggle,
}: {
  session: SessionListItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [qnas, setQnas] = useState<SessionQnAItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const loadQnAs = useCallback(async () => {
    if (qnas) return;
    setLoading(true);
    setError("");
    try {
      const data = await getServerSession(session.id);
      setQnas(data.qnas);
    } catch (err) {
      setError(toUserMessage(err, "Could not load session details."));
    } finally {
      setLoading(false);
    }
  }, [session.id, qnas]);

  useEffect(() => {
    if (isExpanded && !qnas && !loading) {
      void loadQnAs();
    }
  }, [isExpanded, qnas, loading, loadQnAs]);

  const date = new Date(session.startedAt);
  const roleLabel = ROLE_LABELS[session.role] || session.role;
  const companyLabel = session.companyMode === "generic" ? "" : ` · ${session.companyMode}`;

  return (
    <div className="rounded-xl border border-neural-border bg-neural-surface overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-neural-bg/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0">
            {session.debriefScore !== null ? (
              <div className="w-10 h-10 rounded-lg bg-neural-cyan/10 border border-neural-cyan/25 flex items-center justify-center">
                <span className="text-sm font-bold text-neural-cyan tabular-nums">{session.debriefScore}</span>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-neural-border/50 flex items-center justify-center">
                <Brain className="w-4 h-4 text-neural-muted" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {roleLabel}{companyLabel}
            </p>
            <p className="text-xs text-neural-muted">
              {date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
              {" · "}
              {session.questionCount} Q&A{session.questionCount !== 1 ? "s" : ""}
              {session.debriefScore !== null ? ` · Score: ${session.debriefScore}/100` : ""}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-neural-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-neural-muted flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-neural-border px-4 pb-4 pt-3 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-neural-muted text-sm py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading session...
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-red-300 text-xs">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
            </div>
          )}
          {qnas && qnas.length === 0 && (
            <p className="text-sm text-neural-muted text-center py-4">No Q&As recorded for this session.</p>
          )}
          {qnas && qnas.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-neural-border bg-neural-bg/60 p-3">
              <p className="text-xs text-neural-muted font-mono mb-1">Q{i + 1}</p>
              <p className="text-sm font-medium text-white mb-2">{q.question}</p>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{q.answer}</p>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams({
                role: session.role,
                ...(session.companyMode !== "generic" ? { company: session.companyMode } : {}),
              });
              router.push(`/session?${params.toString()}`);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-neural-cyan/40 bg-neural-cyan/10 px-3 py-2 text-xs font-semibold text-neural-cyan hover:bg-neural-cyan/15 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Practice again with this setup
          </button>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await listServerSessions(50, 0);
        setSessions(data.sessions);
      } catch (err) {
        setError(toUserMessage(err, "Could not load session history."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalSessions = sessions.length;
  const totalQnAs = sessions.reduce((acc, s) => acc + s.questionCount, 0);
  const avgScore = (() => {
    const scored = sessions.filter((s) => s.debriefScore !== null);
    if (!scored.length) return null;
    return Math.round(scored.reduce((acc, s) => acc + s.debriefScore!, 0) / scored.length);
  })();

  return (
    <main className="min-h-screen bg-neural-bg">
      <nav className="sticky top-0 z-50 border-b border-neural-border bg-neural-bg/90 backdrop-blur-md px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <Mic className="w-5 h-5 text-neural-cyan" />
            <span className="font-bold text-white">InfinityHire Copilot</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-neural-muted">
            <Link href="/session" className="hover:text-white transition-colors">Session</Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <History className="w-7 h-7 text-neural-cyan" />
          <div>
            <h1 className="text-2xl font-bold text-white">Session History</h1>
            <p className="text-sm text-neural-muted">Review past sessions and track your improvement over time.</p>
          </div>
        </div>

        {!loading && sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-neural-border bg-neural-surface p-4 text-center">
              <p className="text-2xl font-bold text-white tabular-nums">{totalSessions}</p>
              <p className="text-xs text-neural-muted mt-1">Sessions</p>
            </div>
            <div className="rounded-xl border border-neural-border bg-neural-surface p-4 text-center">
              <p className="text-2xl font-bold text-white tabular-nums">{totalQnAs}</p>
              <p className="text-xs text-neural-muted mt-1">Questions practiced</p>
            </div>
            <div className="rounded-xl border border-neural-border bg-neural-surface p-4 text-center">
              <p className="text-2xl font-bold text-neural-cyan tabular-nums">{avgScore ?? "—"}</p>
              <p className="text-xs text-neural-muted mt-1">Avg debrief score</p>
            </div>
          </div>
        )}

        {!loading && <ScoreChart sessions={sessions} />}

        {loading && (
          <div className="flex items-center justify-center gap-2 text-neural-muted py-20">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading history...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}

        {!loading && sessions.length === 0 && !error && (
          <div className="text-center py-20">
            <Calendar className="w-12 h-12 text-neural-muted mx-auto mb-4 opacity-50" />
            <p className="text-neural-muted text-lg mb-2">No sessions yet</p>
            <p className="text-neural-muted text-sm mb-6">Start practicing and your sessions will appear here.</p>
            <Link
              href="/session"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neural-cyan text-black font-bold hover:bg-cyan-300 transition-colors"
            >
              <Mic className="w-4 h-4" /> Start a session
            </Link>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="space-y-3 mt-6">
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isExpanded={expandedId === session.id}
                onToggle={() => setExpandedId(expandedId === session.id ? null : session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
