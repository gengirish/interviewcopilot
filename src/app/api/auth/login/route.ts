import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/server/auth";
import { getUserByEmail } from "@/lib/server/user-store";
import { trackEvent } from "@/lib/server/event-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await signToken({ sub: user.id, email: user.email });
    await trackEvent(user.id, "login_completed", { source: "api" });
    const res = NextResponse.json({ user: { id: user.id, email: user.email } });
    setAuthCookie(res, token);
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
