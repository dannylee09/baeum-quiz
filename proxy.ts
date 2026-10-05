import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  let storageOrigin = "";
  try { storageOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin; } catch {}
  const dev = process.env.NODE_ENV === "development";
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${storageOrigin}`,
    "font-src 'self'",
    `connect-src 'self' ${storageOrigin}${dev ? " ws: wss:" : ""}`,
    `frame-src 'self' blob: ${storageOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce",nonce);
  headers.set("Content-Security-Policy",policy);
  const response = NextResponse.next({request:{headers}});
  response.headers.set("Content-Security-Policy",policy);
  if (request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/result")) {
    response.headers.set("Cache-Control","private, no-store");
    response.headers.set("X-Robots-Tag","noindex, nofollow");
  }
  return response;
}

export const config = { matcher:["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
