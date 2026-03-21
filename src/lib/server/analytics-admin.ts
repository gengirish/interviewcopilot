/**
 * Funnel aggregate is sensitive; restrict to allowlisted emails in production.
 * When ANALYTICS_ADMIN_EMAILS is unset and NODE_ENV is not production, any authenticated user may access (local DX).
 */
export function isAnalyticsFunnelAdmin(email: string): boolean {
  const raw = process.env.ANALYTICS_ADMIN_EMAILS?.trim();
  if (!raw) {
    return process.env.NODE_ENV !== "production";
  }
  const normalized = email.trim().toLowerCase();
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
