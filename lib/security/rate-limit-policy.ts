import { isIP } from "node:net";

export function requestIpIdentity(headers: Headers, isVercel: boolean) {
  // Trust only the deployment platform's rewritten header, never arbitrary XFF.
  if (!isVercel) return "local";
  const address = headers.get("x-vercel-forwarded-for")?.trim();
  if (!address || !isIP(address)) return "unknown-vercel-client";
  return address;
}

export function parseRateLimitDecision(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (typeof value.allowed !== "boolean" || typeof value.retry_after_seconds !== "number" || !Number.isFinite(value.retry_after_seconds)) return null;
  return { allowed: value.allowed, retryAfter: Math.max(1, Math.min(86400, Math.ceil(value.retry_after_seconds))) };
}
