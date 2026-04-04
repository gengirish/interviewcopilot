import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { createSession, listSessions } from "@/lib/server/session-store";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const role = typeof body.role === "string" ? body.role : "backend";
  const companyMode = typeof body.companyMode === "string" ? body.companyMode : "generic";
  const resumeSnippet = typeof body.resumeSnippet === "string" ? body.resumeSnippet : undefined;

  const session = await createSession({
    userId: user.id,
    role,
    companyMode,
    resumeSnippet,
  });

  return NextResponse.json(session, { status: 201 });
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const sessions = await listSessions(user.id, limit, offset);
  return NextResponse.json({ sessions });
}
