import { NextRequest, NextResponse } from "next/server";
import { hashPassword, signToken, setAuthCookie } from "@/lib/server/auth";
import { createUser, getUserByEmail } from "@/lib/server/user-store";
import { trackEvent } from "@/lib/server/event-store";

const MIN_PASSWORD_LEN = 8;
const MAX_EMAIL_LEN = 254;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePasswordStrength(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LEN)
    return `Password must be at least ${MIN_PASSWORD_LEN} characters.`;
  if (/^[0-9]+$/.test(pw))
    return "Password cannot be only numbers. Add letters and symbols.";
  if (/^(.)\1+$/.test(pw))
    return "Password cannot be a single repeated character.";
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasDigitOrSymbol = /[0-9]/.test(pw) || /[^a-zA-Z0-9]/.test(pw);
  if (!hasLetter || !hasDigitOrSymbol)
    return "Password must include letters and at least one number or special character.";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (email.length > MAX_EMAIL_LEN) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const pwError = validatePasswordStrength(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash);
    const token = await signToken({ sub: user.id, email: user.email });
    await trackEvent(user.id, "signup_completed", { source: "api" });

    const res = NextResponse.json({ user: { id: user.id, email: user.email } });
    setAuthCookie(res, token);
    return res;
  } catch (err) {
    console.error("[signup] Unexpected error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
