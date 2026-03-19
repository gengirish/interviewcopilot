import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { trackEvent, type EventType } from "@/lib/server/event-store";

const ALLOWED_EVENTS = new Set<EventType>([
  "session_started",
  "first_question_asked",
  "upgraded_to_pro",
]);

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const eventType = typeof body.eventType === "string" ? (body.eventType as EventType) : null;
  if (!eventType || !ALLOWED_EVENTS.has(eventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  await trackEvent(user.id, eventType, {
    source: typeof body.source === "string" ? body.source : "client",
  });
  return NextResponse.json({ ok: true });
}
