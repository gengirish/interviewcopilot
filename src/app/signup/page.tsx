"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Sign up failed");
        return;
      }
      router.push("/session");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neural-bg flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <Mic className="w-7 h-7 text-neural-cyan" />
          <span className="font-bold text-xl text-white">InfinityHire Copilot</span>
        </Link>
        <div className="rounded-2xl border border-neural-border bg-neural-surface p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Sign up</h1>
          <p className="text-neural-muted text-sm mb-6">
            Create an account to start your interview session.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neural-muted mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg border border-neural-border bg-neural-bg text-white placeholder-neural-muted focus:outline-none focus:border-neural-cyan/50"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neural-muted mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-lg border border-neural-border bg-neural-bg text-white placeholder-neural-muted focus:outline-none focus:border-neural-cyan/50"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-neural-cyan text-black font-bold hover:bg-cyan-300 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-neural-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-neural-cyan hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
