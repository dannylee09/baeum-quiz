import "server-only";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { digest } from "@/lib/security/tokens";
import { getServerSigningSecret } from "@/lib/security/server-secret";
import { parseRateLimitDecision, requestIpIdentity } from "@/lib/security/rate-limit-policy";

export async function enforceRateLimit(
  request: Request,
  options: { scope: string; limit: number; windowSeconds: number; identity?: string },
): Promise<NextResponse | null> {
  try {
    const identity = options.identity ?? requestIpIdentity(request.headers, process.env.VERCEL === "1");
    const key = digest(`${options.scope}:${identity}`, getServerSigningSecret(), "rate-limit-v1");
    const { data, error } = await createAdminSupabaseClient().rpc("rate_limit_check", {
      p_key: key, p_limit: options.limit, p_window_seconds: options.windowSeconds,
    });
    const decision = parseRateLimitDecision(data);
    if (error || !decision) throw new Error("Rate limiter unavailable");
    if (!decision.allowed) return NextResponse.json(
      { errorMessage: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(decision.retryAfter), "Cache-Control": "no-store" } },
    );
    return null;
  } catch {
    // Never bypass the durable limit when the database or migration is unavailable.
    return NextResponse.json(
      { errorMessage: "요청을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503, headers: { "Retry-After": "30", "Cache-Control": "no-store" } },
    );
  }
}
