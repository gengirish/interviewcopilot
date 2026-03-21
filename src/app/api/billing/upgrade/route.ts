/**
 * POST /api/billing/upgrade
 * Mock upgrade to pro. Persists in user store.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { setPlan } from "@/lib/server/user-store";
import { trackEvent } from "@/lib/server/event-store";

function isMockUpgradeAllowed(): boolean {
  if (process.env.ALLOW_MOCK_UPGRADE === "true") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMockUpgradeAllowed()) {
    return NextResponse.json(
      {
        error:
          "Mock billing upgrade is disabled in production. Use a real checkout integration, or set ALLOW_MOCK_UPGRADE=true only for explicit testing.",
      },
      { status: 403 }
    );
  }

  await setPlan(user.id, "pro");
  await trackEvent(user.id, "upgraded_to_pro", { source: "api" });

  return NextResponse.json({ plan: "pro", success: true });
}
