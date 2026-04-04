import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { getSessionWithQnAs, endSession } from "@/lib/server/session-store";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getSessionWithQnAs(params.id, user.id);
  if (!result) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const debriefScore = typeof body.debriefScore === "number" ? body.debriefScore : undefined;

  await endSession(params.id, user.id, debriefScore);
  return NextResponse.json({ ok: true });
}
