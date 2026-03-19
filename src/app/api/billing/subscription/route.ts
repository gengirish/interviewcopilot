/**
 * GET /api/billing/subscription
 * Returns plan, used, remaining, resetAt.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { getPlan } from "@/lib/server/user-store";
import { getUsage, getResetAt } from "@/lib/server/usage-store";
import { getPlanLimit } from "@/lib/server/plans";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await getPlan(user.id);
  const used = await getUsage(user.id);
  const limit = getPlanLimit(plan);
  const remaining =
    limit === Number.POSITIVE_INFINITY ? Infinity : Math.max(0, limit - used);
  const resetAt = getResetAt();

  return NextResponse.json({
    plan,
    used,
    remaining: remaining === Infinity ? "unlimited" : remaining,
    resetAt: resetAt.toISOString(),
  });
}
