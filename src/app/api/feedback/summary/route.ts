import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { getAnswerFeedbackMonthlySummary } from "@/lib/server/feedback-store";
import { getMonthKey } from "@/lib/server/usage-store";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const monthParam = req.nextUrl.searchParams.get("month");
  const monthKey =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : getMonthKey();

  const summary = await getAnswerFeedbackMonthlySummary(user.id, monthKey);
  return NextResponse.json(summary);
}
