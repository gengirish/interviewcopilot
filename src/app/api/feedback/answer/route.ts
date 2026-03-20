import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { insertAnswerFeedback } from "@/lib/server/feedback-store";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const qnaId = typeof body.qnaId === "string" ? body.qnaId.trim() : "";
  const question = typeof body.question === "string" ? body.question : "";
  const answer = typeof body.answer === "string" ? body.answer : "";
  const source = typeof body.source === "string" ? body.source.trim() : "";
  const rating = body.rating === "up" || body.rating === "down" ? body.rating : null;
  const reason =
    body.reason === undefined || body.reason === null
      ? null
      : typeof body.reason === "string"
        ? body.reason
        : null;

  if (!qnaId || !isNonEmptyString(question) || !isNonEmptyString(answer) || !source || !rating) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await insertAnswerFeedback({
      userId: user.id,
      qnaId,
      question,
      answer,
      source,
      rating,
      reason,
    });
  } catch {
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
