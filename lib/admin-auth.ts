import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createSessionToken, digest, sessionMaxAgeSeconds, verifySessionToken } from "@/lib/security/tokens";
import { getServerSigningSecret } from "@/lib/security/server-secret";

export const adminSessionCookieName = "baeum_admin_session";
export const adminSessionMaxAgeSeconds = sessionMaxAgeSeconds;

export function isAdminPasswordConfigured() {
  return Boolean(getAdminPassword());
}

export async function isAdminAuthenticated() {
  const password = getAdminPassword();
  const token = (await cookies()).get(adminSessionCookieName)?.value;
  if (!password || !token) return false;
  try {
    return verifySessionToken(token, sessionSecret(password));
  } catch {
    return false;
  }
}

export function verifyAdminPassword(input: string) {
  const password = getAdminPassword();
  if (!password || input.length > 1024) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(input), hash(password));
}

export function createAdminSessionToken() {
  const password = getAdminPassword();
  if (!password) throw new Error("ADMIN_PASSWORD is not configured.");
  return createSessionToken(sessionSecret(password));
}

function sessionSecret(password: string) {
  // Rotating either credential invalidates existing sessions.
  return digest(password, getServerSigningSecret(), "admin-password-binding-v2");
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || null;
}
