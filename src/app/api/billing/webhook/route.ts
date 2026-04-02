/**
 * POST /api/billing/webhook
 * Stripe webhook: verify signature, grant Pro on successful subscription checkout.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/server/stripe";
import { getUserById, setPlan } from "@/lib/server/user-store";
import { trackEvent } from "@/lib/server/event-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUserId(id: string | undefined): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

async function grantProIfNeeded(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    console.warn("[billing/webhook] user not found for userId", userId);
    return;
  }
  const previous = user.plan;
  await setPlan(userId, "pro");
  if (previous !== "pro") {
    await trackEvent(userId, "upgraded_to_pro", { source: "stripe" });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "subscription") return;
  if (session.status !== "complete") return;
  const userId = session.metadata?.userId;
  if (!isValidUserId(userId)) {
    console.warn("[billing/webhook] checkout.session.completed missing valid userId metadata");
    return;
  }
  await grantProIfNeeded(userId);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const status = subscription.status;
  if (status !== "active" && status !== "trialing") return;
  const userId = subscription.metadata?.userId;
  if (!isValidUserId(userId)) return;
  await grantProIfNeeded(userId);
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook endpoint is not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe-Signature header" }, { status: 400 });
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid payload";
    console.warn("[billing/webhook] signature verification failed:", msg);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[billing/webhook] handler error:", message);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
