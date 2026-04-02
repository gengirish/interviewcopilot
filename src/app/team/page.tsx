"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Mic, Users, ArrowLeft, Copy, Check, ClipboardList, Loader2, AlertTriangle } from "lucide-react";
import { generateTeamSummary, toUserMessage, trackEvent } from "@/lib/api";

export default function TeamPanelPage() {
  const [rubric, setRubric] = useState("");
  const [notes, setNotes] = useState("");
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const { summary } = await generateTeamSummary({
        rubric: rubric.trim(),
        notes: notes.trim(),
      });
      setSummaryText(summary);
      void trackEvent("team_panel_summary_generated", {
        metadata: { rubricLen: rubric.trim().length, notesLen: notes.trim().length },
      }).catch(() => {
        /* non-fatal */
      });
    } catch (e) {
      setSummaryText(null);
      setError(toUserMessage(e, "Could not generate summary."));
    } finally {
      setLoading(false);
    }
  }, [rubric, notes]);

  const copySummary = useCallback(() => {
    if (!summaryText) return;
    void navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [summaryText]);

  return (
    <main className="min-h-screen bg-neural-bg">
      <header className="sticky top-0 z-50 border-b border-neural-border bg-neural-bg/90 backdrop-blur-md px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 text-neural-muted hover:text-white transition-colors">
              <Mic className="w-5 h-5 text-neural-cyan" />
              <span className="font-bold text-white">InfinityHire Copilot</span>
            </Link>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neural-surface border border-neural-border text-neural-muted">
              Team panel
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/session"
              className="text-xs text-neural-muted hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Session
            </Link>
            <Link href="/dashboard" className="text-xs text-neural-muted hover:text-white transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start gap-3">
          <Users className="w-8 h-8 text-neural-cyan shrink-0 mt-1" />
          <div>
            <h1 className="text-2xl font-bold text-white">Team panel mode</h1>
            <p className="text-sm text-neural-muted mt-1 leading-relaxed">
              Enter the loop rubric and panel notes, then generate a shareable summary draft.
            </p>
          </div>
        </div>

        <section
          aria-label="Rubric and notes"
          className="rounded-xl border border-neural-border bg-neural-surface p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-neural-purple" />
            <h2 className="text-lg font-semibold text-white">Rubric &amp; notes</h2>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neural-muted" htmlFor="team-rubric-input">
              Rubric / competencies
            </label>
            <textarea
              id="team-rubric-input"
              data-testid="team-rubric-input"
              value={rubric}
              onChange={(e) => setRubric(e.target.value.slice(0, 4000))}
              placeholder="e.g. Communication: strong. System design: needs depth on consistency…"
              rows={5}
              className="w-full rounded-lg border border-neural-border bg-neural-bg px-3 py-2 text-sm text-white placeholder-neural-muted focus:outline-none focus:border-neural-cyan/50 resize-y min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neural-muted" htmlFor="team-notes-input">
              Panel notes
            </label>
            <textarea
              id="team-notes-input"
              data-testid="team-notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 4000))}
              placeholder="Strengths, concerns, level, follow-ups…"
              rows={6}
              className="w-full rounded-lg border border-neural-border bg-neural-bg px-3 py-2 text-sm text-white placeholder-neural-muted focus:outline-none focus:border-neural-cyan/50 resize-y min-h-[120px]"
            />
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="team-generate-summary"
            disabled={loading}
            onClick={() => void handleGenerate()}
            className="inline-flex items-center gap-2 rounded-xl bg-neural-purple/30 border border-neural-purple/50 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neural-purple/40 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <ClipboardList className="w-4 h-4 text-neural-cyan" />
                Generate panel summary
              </>
            )}
          </button>
        </div>

        {summaryText && (
          <section
            data-testid="team-summary-output"
            className="rounded-xl border border-neural-cyan/20 bg-neural-bg/80 p-5 space-y-3"
          >
            <h2 className="text-sm font-semibold text-white">Panel summary</h2>
            <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
              {summaryText}
            </pre>
            <button
              type="button"
              onClick={() => copySummary()}
              className="inline-flex items-center gap-2 rounded-lg border border-neural-border px-3 py-2 text-xs font-semibold text-neural-muted hover:text-white transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-neural-green" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy summary
                </>
              )}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
