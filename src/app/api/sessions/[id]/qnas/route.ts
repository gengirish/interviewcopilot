import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { addQnA } from "@/lib/server/session-store";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const source = typeof body.source === "string" ? body.source : "ai";

  if (!question || !answer) {
    return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
  }

  try {
    const qna = await addQnA({
      sessionId: params.id,
      userId: user.id,
      question,
      answer,
      source,
    });
    return NextResponse.json(qna, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Session not found") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    throw err;
  }
}
