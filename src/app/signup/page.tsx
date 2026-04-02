"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, Eye, EyeOff } from "lucide-react";

function getPasswordStrength(pw: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  hints: string[];
} {
  const hints: string[] = [];
  if (pw.length < 8) hints.push("At least 8 characters");
  if (!/[a-z]/.test(pw)) hints.push("Add a lowercase letter");
  if (!/[A-Z]/.test(pw)) hints.push("Add an uppercase letter");
  if (!/[0-9]/.test(pw)) hints.push("Add a number");
  if (!/[^a-zA-Z0-9]/.test(pw)) hints.push("Add a special character (!@#$...)");
  if (/^[0-9]+$/.test(pw)) hints.push("Don't use only numbers — mix letters and symbols");
  if (/^(.)\1+$/.test(pw)) hints.push("Don't repeat the same character");

  const passed = 5 - hints.length;
  const score = Math.min(4, Math.max(0, passed)) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-400",
    "bg-neural-green",
  ];

  return { score, label: labels[score], color: colors[score], hints };
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordTouched = password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (strength.score < 2) {
      setError(
        "Password is too weak. " +
          (strength.hints[0] || "Use a mix of letters, numbers, and symbols."),
      );
      return;
    }

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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mix letters, numbers & symbols"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 pr-11 rounded-lg border border-neural-border bg-neural-bg text-white placeholder-neural-muted focus:outline-none focus:border-neural-cyan/50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neural-muted hover:text-white transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {passwordTouched && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-neural-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${(strength.score / 4) * 100}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        strength.score < 2
                          ? "text-red-400"
                          : strength.score < 3
                            ? "text-yellow-400"
                            : "text-neural-green"
                      }`}
                    >
                      {strength.label}
                    </span>
                  </div>
                  {strength.hints.length > 0 && strength.score < 3 && (
                    <ul className="text-xs text-neural-muted space-y-0.5">
                      {strength.hints.slice(0, 3).map((hint) => (
                        <li key={hint} className="flex items-start gap-1.5">
                          <span className="text-neural-muted mt-0.5">•</span>
                          {hint}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
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
