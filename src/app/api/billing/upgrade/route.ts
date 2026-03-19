/**
 * POST /api/billing/upgrade
 * Mock upgrade to pro. Persists in user store.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { setPlan } from "@/lib/server/user-store";
import { trackEvent } from "@/lib/server/event-store";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await setPlan(user.id, "pro");
  await trackEvent(user.id, "upgraded_to_pro", { source: "api" });

  return NextResponse.json({ plan: "pro", success: true });
}
