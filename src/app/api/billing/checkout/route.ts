/**
 * POST /api/billing/checkout
 * Authenticated Stripe Checkout Session for Pro monthly subscription.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { getAppBaseUrl, getStripe, getStripePriceIdProMonthly } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let stripeClient: ReturnType<typeof getStripe>;
  let priceId: string;
  let appUrl: string;
  try {
    stripeClient = getStripe();
    priceId = getStripePriceIdProMonthly();
    appUrl = getAppBaseUrl();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Billing is not configured";
    return NextResponse.json(
      {
        error:
          "Checkout is not available. Configure STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PRO_MONTHLY, and NEXT_PUBLIC_APP_URL (in production).",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 503 }
    );
  }

  try {
    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/dashboard?checkout=canceled`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        email: user.email,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          email: user.email,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Could not create checkout session URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe error";
    console.error("[billing/checkout]", message);
    return NextResponse.json(
      { error: "Could not start checkout. Try again later." },
      { status: 502 }
    );
  }
}
