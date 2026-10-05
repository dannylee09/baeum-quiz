import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sessionMaxAgeSeconds = 60 * 60 * 8;
const retryMaxAgeSeconds = 60 * 30;

export function digest(value: string, secret: string, purpose: string) {
  return createHmac("sha256", secret).update(`${purpose}\0${value}`).digest("base64url");
}

function signatureMatches(actual: string, expected: string) {
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function createSessionToken(secret: string, now = Date.now()) {
  const value = `${now}.${randomBytes(24).toString("base64url")}`;
  return `${value}.${digest(value, secret, "admin-session-v2")}`;
}

export function verifySessionToken(token: string, secret: string, now = Date.now()) {
  if (!/^\d{13}\.[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [issuedAtText, nonce, signature] = token.split(".");
  const age = now - Number(issuedAtText);
  return age >= 0 && age < sessionMaxAgeSeconds * 1000 && signatureMatches(signature, digest(`${issuedAtText}.${nonce}`, secret, "admin-session-v2"));
}

type RetryIdentity = { quizSetId: string; studentNo: string; studentName: string; requestId: string };

export function createRetryToken(identity: RetryIdentity, secret: string, now = Date.now()) {
  const timestamp = String(now);
  return `${timestamp}.${digest(retryValue(identity, timestamp), secret, "submission-retry-v1")}`;
}

export function verifyRetryToken(token: string | undefined, identity: RetryIdentity, secret: string, now = Date.now()) {
  if (!token || !/^\d{13}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [timestamp, signature] = token.split(".");
  const age = now - Number(timestamp);
  return age >= 0 && age < retryMaxAgeSeconds * 1000 && signatureMatches(signature, digest(retryValue(identity, timestamp), secret, "submission-retry-v1"));
}

function retryValue(identity: RetryIdentity, timestamp: string) {
  return JSON.stringify([identity.quizSetId, identity.studentNo, identity.studentName, identity.requestId, timestamp]);
}
