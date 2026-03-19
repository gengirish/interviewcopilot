"use client";

import { useState } from "react";
import Link from "next/link";
import { Mic, Loader2, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

type Tab = "login" | "signup";

export default function LoginPage() {
  const [redirectTo, setRedirectTo] = useState("/session");
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    if (redirect && redirect.startsWith("/")) {
      setRedirectTo(redirect);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      window.location.href = redirectTo.startsWith("/") ? redirectTo : "/session";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neural-bg flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Mic className="w-7 h-7 text-neural-cyan" />
            <span className="font-bold text-xl text-white">InterviewCopilot</span>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">
            {tab === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-neural-muted text-sm">
            {tab === "login"
              ? "Sign in to start your interview session"
              : "Sign up to get started"}
          </p>
        </div>

        <div className="rounded-2xl border border-neural-border bg-neural-surface p-6">
          <div className="flex rounded-lg border border-neural-border p-1 mb-6">
            <button
              type="button"
              onClick={() => { setTab("login"); setError(""); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === "login"
                  ? "bg-neural-cyan text-black"
                  : "text-neural-muted hover:text-white"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setTab("signup"); setError(""); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === "signup"
                  ? "bg-neural-cyan text-black"
                  : "text-neural-muted hover:text-white"
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neural-muted mb-2">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete={tab === "login" ? "email" : "email"}
                className="w-full px-4 py-3 rounded-lg border border-neural-border bg-neural-bg text-white text-sm placeholder-neural-muted focus:outline-none focus:border-neural-cyan/50"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neural-muted mb-2">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "signup" ? "Min 8 characters" : "••••••••"}
                required
                minLength={tab === "signup" ? 8 : undefined}
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                className="w-full px-4 py-3 rounded-lg border border-neural-border bg-neural-bg text-white text-sm placeholder-neural-muted focus:outline-none focus:border-neural-cyan/50"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-neural-cyan text-black font-bold hover:bg-cyan-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Please wait…</>
              ) : (
                tab === "login" ? "Sign in" : "Create account"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-neural-muted mt-6">
          <Link href="/" className="text-neural-cyan hover:underline">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}
