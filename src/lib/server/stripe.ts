import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripe) {
    stripe = new Stripe(key);
  }
  return stripe;
}

export function getStripePriceIdProMonthly(): string {
  const id = process.env.STRIPE_PRICE_ID_PRO_MONTHLY?.trim();
  if (!id) {
    throw new Error("STRIPE_PRICE_ID_PRO_MONTHLY is not set");
  }
  return id;
}

export function getAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }
  return "http://localhost:3004";
}
