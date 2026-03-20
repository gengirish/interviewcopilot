import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { getActivationSummary, getFunnelAggregate } from "@/lib/server/event-store";
import type { AnalyticsFunnelResponse } from "@/lib/types";

function parseWindowDays(req: NextRequest): 7 | 30 {
  const raw = req.nextUrl.searchParams.get("window");
  if (raw === "7") return 7;
  return 30;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const windowDays = parseWindowDays(req);

  const [activation, aggregate] = await Promise.all([
    getActivationSummary(user.id),
    getFunnelAggregate(windowDays),
  ]);

  const body: AnalyticsFunnelResponse = {
    user: {
      activationScore: activation.score,
      completed: activation.completed,
      pending: activation.pending,
    },
    aggregate,
  };

  return NextResponse.json(body);
}
