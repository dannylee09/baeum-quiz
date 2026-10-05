import { NextResponse } from "next/server";
import { adminSessionCookieName, adminSessionMaxAgeSeconds, createAdminSessionToken, isAdminPasswordConfigured, verifyAdminPassword } from "@/lib/admin-auth";
import { readJsonBody, validateMutationRequest } from "@/lib/request-security";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { isRecord } from "@/lib/security/validation";

export async function POST(request: Request) {
  const blocked = validateMutationRequest(request);
  if (blocked) return blocked;
  if (!isAdminPasswordConfigured()) return NextResponse.json({ ok: false, errorMessage: "관리자 로그인 설정을 확인해 주세요." }, { status: 503 });

  const limited = await enforceRateLimit(request, { scope: "admin-login", limit: 8, windowSeconds: 900 });
  if (limited) return limited;
  const body = await readJsonBody(request, 4096);
  if (!body.ok) return body.response;
  if (!isRecord(body.value) || typeof body.value.password !== "string" || !verifyAdminPassword(body.value.password)) {
    return NextResponse.json({ ok: false, errorMessage: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  try {
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set({ name: adminSessionCookieName, value: createAdminSessionToken(), httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: adminSessionMaxAgeSeconds });
    return response;
  } catch {
    return NextResponse.json({ ok: false, errorMessage: "관리자 로그인 설정을 확인해 주세요." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const blocked = validateMutationRequest(request);
  if (blocked) return blocked;
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({ name: adminSessionCookieName, value: "", httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
