/**
 * Billing plan types, limits, and helpers.
 * free: 30 answers/month
 * pro: unlimited
 */

export type PlanId = "free" | "pro";

export const PLAN_LIMITS: Record<PlanId, { answersPerMonth: number }> = {
  free: { answersPerMonth: 30 },
  pro: { answersPerMonth: Number.POSITIVE_INFINITY },
};

export function getPlanLimit(plan: PlanId): number {
  return PLAN_LIMITS[plan]?.answersPerMonth ?? PLAN_LIMITS.free.answersPerMonth;
}

export function isUnlimited(plan: PlanId): boolean {
  return getPlanLimit(plan) === Number.POSITIVE_INFINITY;
}

export function getDefaultPlan(): PlanId {
  return "free";
}
