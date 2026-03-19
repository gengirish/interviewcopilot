import { NextRequest, NextResponse } from "next/server";
import { hashPassword, signToken, setAuthCookie } from "@/lib/server/auth";
import { createUser, getUserByEmail } from "@/lib/server/user-store";
import { trackEvent } from "@/lib/server/event-store";

const MIN_PASSWORD_LEN = 8;
const MAX_EMAIL_LEN = 254;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    if (password.length < MIN_PASSWORD_LEN) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LEN} characters` },
        { status: 400 }
      );
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
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
