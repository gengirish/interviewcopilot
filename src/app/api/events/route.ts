import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { trackEvent, type EventType } from "@/lib/server/event-store";

const ALLOWED_EVENTS = new Set<EventType>([
  "session_started",
  "first_question_asked",
  "upgraded_to_pro",
  "onboarding_started",
  "onboarding_step_completed",
  "onboarding_dismissed",
  "sample_question_used",
  "debrief_generated",
  "team_panel_summary_generated",
  "best_answer_rewritten",
  "question_bank_generated",
  "prep_plan_generated",
]);

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const eventType = typeof body.eventType === "string" ? (body.eventType as EventType) : null;
  if (!eventType || !ALLOWED_EVENTS.has(eventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const metadata: Record<string, unknown> = {
    source: typeof body.source === "string" ? body.source : "client",
  };
  const rawMeta = body.metadata;
  if (rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)) {
    for (const [k, v] of Object.entries(rawMeta as Record<string, unknown>)) {
      if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        metadata[k] = v;
      }
    }
  }

  await trackEvent(user.id, eventType, metadata);
  return NextResponse.json({ ok: true });
}
