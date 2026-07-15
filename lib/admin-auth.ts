import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";

export const adminSessionCookieName = "baeum_admin_session";
export const adminSessionMaxAgeSeconds = 60 * 60 * 8;

export function isAdminPasswordConfigured() {
  return Boolean(getAdminPassword());
}

export async function isAdminAuthenticated() {
  const password = getAdminPassword();

  if (!password) {
    return false;
  }

  const token = (await cookies()).get(adminSessionCookieName)?.value;

  if (!token) {
    return false;
  }

  return verifyAdminSessionToken(token, password);
}

export function verifyAdminPassword(input: string) {
  const password = getAdminPassword();

  if (!password) {
    return false;
  }

  const inputBuffer = Buffer.from(input);
  const passwordBuffer = Buffer.from(password);

  if (inputBuffer.length !== passwordBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, passwordBuffer);
}

export function createAdminSessionToken() {
  const password = getAdminPassword();

  if (!password) {
    throw new Error("ADMIN_PASSWORD is not configured.");
  }

  const issuedAt = Date.now();
  const signature = signAdminSession(String(issuedAt), password);

  return `${issuedAt}.${signature}`;
}

function verifyAdminSessionToken(token: string, password: string) {
  const [issuedAtText, signature] = token.split(".");
  const issuedAt = Number(issuedAtText);

  if (!issuedAtText || !signature || !Number.isFinite(issuedAt)) {
    return false;
  }

  if (Date.now() - issuedAt > adminSessionMaxAgeSeconds * 1000) {
    return false;
  }

  const expectedSignature = signAdminSession(issuedAtText, password);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

function signAdminSession(value: string, password: string) {
  return crypto.createHmac("sha256", password).update(value).digest("base64url");
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || null;
}
