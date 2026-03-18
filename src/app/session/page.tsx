"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Mic, MicOff, Brain, FileText, Upload, X, ChevronDown, Copy, Check, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = "ml-engineer" | "data-scientist" | "ai-architect" | "backend" | "fullstack" | "product";
type QnA = { id: string; question: string; answer: string; timestamp: Date };

const ROLES: { value: Role; label: string; emoji: string }[] = [
  { value: "ml-engineer", label: "ML / AI Engineer", emoji: "🤖" },
  { value: "data-scientist", label: "Data Scientist", emoji: "📊" },
  { value: "ai-architect", label: "AI Solutions Architect", emoji: "🏗️" },
  { value: "backend", label: "Backend Engineer", emoji: "💻" },
  { value: "fullstack", label: "Full-Stack Engineer", emoji: "📱" },
  { value: "product", label: "Product Manager", emoji: "🎯" },
];

// ── Speech Recognition hook ────────────────────────────────────────────────
function useSpeechRecognition(onQuestion: (q: string) => void) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const accumulatedRef = useRef("");

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return alert("Speech recognition not supported. Use Chrome or Edge.");
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";

    r.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) {
        accumulatedRef.current += " " + final;
        setTranscript(accumulatedRef.current.trim());
        // Reset silence timer — if 3s of silence after a sentence, treat as question
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        silenceTimer.current = setTimeout(() => {
          const q = accumulatedRef.current.trim();
          if (q.length > 10) {
            onQuestion(q);
            accumulatedRef.current = "";
            setTranscript("");
          }
        }, 3000);
      } else {
        setTranscript((accumulatedRef.current + " " + interim).trim());
      }
    };
    r.onerror = () => setIsListening(false);
    r.onend = () => {
      if (isListening) r.start(); // auto-restart
    };
    recognitionRef.current = r;
    r.start();
    setIsListening(true);
  }, [onQuestion, isListening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    accumulatedRef.current = "";
    setTranscript("");
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
  }, []);

  return { isListening, transcript, start, stop };
}

// ── Answer card ───────────────────────────────────────────────────────────────
function AnswerCard({ qna }: { qna: QnA }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(qna.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border border-neural-border bg-neural-surface p-4 animate-fade-in">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span className="text-xs text-neural-muted font-mono">{qna.timestamp.toLocaleTimeString()}</span>
          <p className="text-white font-medium text-sm mt-1">❓ {qna.question}</p>
        </div>
        <button onClick={copy} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-neural-border transition-colors text-neural-muted hover:text-white">
          {copied ? <Check className="w-4 h-4 text-neural-green" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="border-t border-neural-border pt-3">
        <p className="text-neural-cyan text-xs font-mono mb-1">💡 AI Answer:</p>
        <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{qna.answer}</p>
      </div>
    </div>
  );
}

// ── Main session page ─────────────────────────────────────────────────────────
export default function SessionPage() {
  const [role, setRole] = useState<Role>("ml-engineer");
  const [resumeText, setResumeText] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [qnas, setQnas] = useState<QnA[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleQuestion = useCallback(async (question: string) => {
    setCurrentQuestion(question);
    setLoading(true);
    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, role, resumeText }),
      });
      const { answer } = await res.json();
      setQnas((prev) => [...prev, {
        id: Date.now().toString(),
        question,
        answer: answer || "Could not generate answer. Please try again.",
        timestamp: new Date(),
      }]);
    } catch {
      setQnas((prev) => [...prev, { id: Date.now().toString(), question, answer: "Network error. Please check connection.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
      setCurrentQuestion("");
    }
  }, [role, resumeText]);

  const { isListening, transcript, start, stop } = useSpeechRecognition(handleQuestion);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qnas]);

  const handleFileUpload = async (file: File) => {
    setResumeName(file.name);
    if (file.type === "text/plain") {
      const text = await file.text();
      setResumeText(text);
    } else {
      // For PDF, send to API for parsing
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/extract-resume", { method: "POST", body: formData });
        const { text } = await res.json();
        setResumeText(text || "");
      } catch {
        setResumeText("Could not parse PDF. Please paste resume text below.");
      }
    }
  };

  if (!sessionStarted) {
    return (
      <main className="min-h-screen bg-neural-bg flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <Mic className="w-7 h-7 text-neural-cyan" />
              <span className="font-bold text-xl text-white">InterviewCopilot</span>
            </Link>
            <h1 className="text-3xl font-bold text-white mb-2">Set up your session</h1>
            <p className="text-neural-muted text-sm">Takes 30 seconds. Works with any Zoom/Meet/Teams call.</p>
          </div>

          <div className="space-y-5 rounded-2xl border border-neural-border bg-neural-surface p-8">
            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-neural-muted mb-2">Your role</label>
              <div className="relative">
                <select value={role} onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-4 py-3 rounded-lg border border-neural-border bg-neural-bg text-white text-sm focus:outline-none focus:border-neural-cyan/50 appearance-none cursor-pointer">
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.emoji} {r.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neural-muted pointer-events-none" />
              </div>
            </div>

            {/* Resume upload */}
            <div>
              <label className="block text-sm font-medium text-neural-muted mb-2">Resume (optional but recommended)</label>
              <div
                className="border-2 border-dashed border-neural-border rounded-lg p-6 text-center cursor-pointer hover:border-neural-cyan/40 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                onDragOver={(e) => e.preventDefault()}>
                {resumeName ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-neural-cyan" />
                    <span className="text-white text-sm">{resumeName}</span>
                    <button onClick={(e) => { e.stopPropagation(); setResumeName(""); setResumeText(""); }}
                      className="text-neural-muted hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-neural-muted mx-auto mb-2" />
                    <p className="text-neural-muted text-sm">Drop PDF or TXT · click to browse</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
              </div>
            </div>

            {/* Manual resume paste */}
            <div>
              <label className="block text-sm font-medium text-neural-muted mb-2">Or paste resume text</label>
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume here for personalised AI answers..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-neural-border bg-neural-bg text-white text-sm placeholder-neural-muted focus:outline-none focus:border-neural-cyan/50 resize-none" />
            </div>

            <button
              onClick={() => setSessionStarted(true)}
              className="w-full py-4 rounded-xl bg-neural-cyan text-black font-bold hover:bg-cyan-300 transition-colors flex items-center justify-center gap-2 text-lg">
              <Mic className="w-5 h-5" /> Start Session
            </button>
            <p className="text-xs text-neural-muted text-center">Microphone permission required. Works best in Chrome/Edge.</p>
          </div>
        </div>
      </main>
    );
  }

  const selectedRole = ROLES.find((r) => r.value === role)!;

  return (
    <main className="min-h-screen bg-neural-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-neural-border bg-neural-bg/90 backdrop-blur-md px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-neural-cyan" />
            <span className="font-bold text-white">InterviewCopilot</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neural-surface border border-neural-border text-neural-muted">
              {selectedRole.emoji} {selectedRole.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {resumeText && (
              <span className="text-xs text-neural-green flex items-center gap-1">
                <FileText className="w-3 h-3" /> Resume loaded
              </span>
            )}
            <Link href="/" className="text-xs text-neural-muted hover:text-white transition-colors">Exit</Link>
          </div>
        </div>
      </header>

      {/* Q&A feed */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-4 overflow-y-auto">
        {qnas.length === 0 && !isListening && (
          <div className="text-center py-20">
            <Brain className="w-16 h-16 text-neural-muted mx-auto mb-4 opacity-50" />
            <p className="text-neural-muted text-lg">Ready when you are.</p>
            <p className="text-neural-muted text-sm mt-2">Press <strong className="text-white">Start Listening</strong> then speak your interview question.</p>
          </div>
        )}
        {qnas.map((qna) => <AnswerCard key={qna.id} qna={qna} />)}

        {/* Loading indicator */}
        {loading && (
          <div className="rounded-xl border border-neural-cyan/30 bg-neural-surface/50 p-4 animate-fade-in">
            <p className="text-neural-muted text-xs font-mono mb-2">❓ {currentQuestion}</p>
            <div className="flex items-center gap-2 text-neural-cyan text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating answer…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Live transcript bar */}
      {isListening && transcript && (
        <div className="border-t border-neural-border bg-neural-surface/80 px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs text-neural-muted font-mono mb-1">🎙️ Hearing:</p>
            <p className="text-white text-sm">{transcript}<span className="animate-blink">|</span></p>
          </div>
        </div>
      )}

      {/* Control bar */}
      <div className="border-t border-neural-border bg-neural-bg px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm text-neural-muted">
            {isListening
              ? <span className="text-neural-green flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" /> Listening — speak now</span>
              : <span>Click to start listening</span>}
          </div>
          <div className="flex items-center gap-3">
            {qnas.length > 0 && (
              <button onClick={() => setQnas([])} className="text-xs text-neural-muted hover:text-red-400 transition-colors">
                Clear session
              </button>
            )}
            <button
              onClick={isListening ? stop : start}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 text-white recording-pulse"
                  : "bg-neural-cyan hover:bg-cyan-300 text-black"
              }`}>
              {isListening ? <><MicOff className="w-4 h-4" /> Stop</> : <><Mic className="w-4 h-4" /> Start Listening</>}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
