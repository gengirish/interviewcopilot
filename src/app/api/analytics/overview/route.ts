import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { getPlan } from "@/lib/server/user-store";
import { getPlanLimit } from "@/lib/server/plans";
import { getUsage } from "@/lib/server/usage-store";
import { getActivationSummary } from "@/lib/server/event-store";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await getPlan(user.id);
  const answersThisMonth = await getUsage(user.id);
  const activation = await getActivationSummary(user.id);
  const monthlyQuota = getPlanLimit(plan);
  const remainingQuota =
    monthlyQuota === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Math.max(0, monthlyQuota - answersThisMonth);

  return NextResponse.json({
    plan,
    answersThisMonth,
    monthlyQuota:
      monthlyQuota === Number.POSITIVE_INFINITY ? -1 : monthlyQuota,
    remainingQuota:
      remainingQuota === Number.POSITIVE_INFINITY ? "unlimited" : remainingQuota,
    activation,
  });
}
