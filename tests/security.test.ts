import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readJsonBody, validateMutationRequest } from "@/lib/request-security";
import { parseSubmissionPayload } from "@/lib/security/validation";
import { createRetryToken, createSessionToken, sessionMaxAgeSeconds, verifyRetryToken, verifySessionToken } from "@/lib/security/tokens";
import { parseRateLimitDecision, requestIpIdentity } from "@/lib/security/rate-limit-policy";

const url = "https://baeum-quiz.vercel.app/api/submissions";
const quizSetId = "11111111-1111-4111-8111-111111111111";
const questionId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const identity = { quizSetId, requestId, studentNo: "21017", studentName: "테스트" };
const payload = { ...identity, answers: [{ questionId, rawAnswer: "3" }], isFinalAttempt: false };
const secret = "only-a-test-signing-secret-with-enough-entropy";
const now = 1_800_000_000_000;

function request(body: string, extraHeaders: Record<string, string> = {}) {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", origin: new URL(url).origin, ...extraHeaders }, body });
}

describe("mutation request protection", () => {
  it("handles Next internal hostname while ignoring forwarded host spoofing", () => {
    const valid = new Request("http://localhost:3310/api/test", {method:"POST",headers:{host:"127.0.0.1:3310",origin:"http://127.0.0.1:3310","sec-fetch-site":"same-origin"}});
    assert.equal(validateMutationRequest(valid),null);
    const spoofed = new Request("https://school.test/api/test", {method:"POST",headers:{host:"school.test",origin:"https://evil.test","x-forwarded-host":"evil.test"}});
    assert.equal(validateMutationRequest(spoofed)?.status,403);
  });
  it("allows same-origin browser requests", () => assert.equal(validateMutationRequest(request("{}", { "sec-fetch-site": "same-origin" })), null));
  it("rejects cross-origin and sibling-domain requests", () => {
    assert.equal(validateMutationRequest(request("{}", { origin: "https://evil.example" }))?.status, 403);
    assert.equal(validateMutationRequest(request("{}", { "sec-fetch-site": "same-site" }))?.status, 403);
  });
  it("rejects missing and opaque origins", () => {
    assert.equal(validateMutationRequest(new Request(url, { method: "POST" }))?.status, 403);
    assert.equal(validateMutationRequest(request("{}", { origin: "null" }))?.status, 403);
  });
  it("reads valid UTF-8 JSON and catches malformed JSON", async () => {
    assert.deepEqual(await readJsonBody(request('{"name":"학생"}')), { ok: true, value: { name: "학생" } });
    const broken = await readJsonBody(request("{"));
    assert.equal(broken.ok, false);
    if (!broken.ok) assert.equal(broken.response.status, 400);
  });
  it("requires JSON content type", async () => {
    const result = await readJsonBody(request("{}", { "content-type": "text/plain" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.response.status, 415);
  });
  it("enforces actual byte length without trusting Content-Length", async () => {
    for (const headers of [{}, { "content-length": "2" }] as Record<string, string>[]) {
      const result = await readJsonBody(request('{"v":"학생학생"}', headers), 12);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.response.status, 413);
    }
  });
  it("rejects oversized declared bodies before reading", async () => {
    const result = await readJsonBody(request("{}", { "content-length": "9999999" }), 1024);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.response.status, 413);
  });
  it("caps multiple streamed chunks with no Content-Length", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode('{"v":"')); controller.enqueue(encoder.encode("x".repeat(50))); controller.close(); } });
    const streamed = new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
    const result = await readJsonBody(streamed, 32);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.response.status, 413);
  });
});

describe("submission validation", () => {
  it("accepts the supported payload with trimmed identity", () => {
    const result = parseSubmissionPayload({ ...payload, studentNo: " 21017 ", studentName: " 테스트 " });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.studentName, "테스트");
  });
  it("does not crash on null, arrays, or primitive JSON", () => {
    for (const bad of [null, [], false, 2, "value", {}]) assert.equal(parseSubmissionPayload(bad).ok, false);
  });
  it("requires UUID quiz, question, and idempotency identifiers", () => {
    assert.equal(parseSubmissionPayload({ ...payload, quizSetId: "bad" }).ok, false);
    assert.equal(parseSubmissionPayload({ ...payload, requestId: undefined }).ok, false);
    assert.equal(parseSubmissionPayload({ ...payload, answers: [{ questionId: "bad", rawAnswer: "3" }] }).ok, false);
  });
  it("rejects duplicate question ids, including different letter casing", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    assert.equal(parseSubmissionPayload({ ...payload, answers: [{ questionId: id, rawAnswer: "3" }, { questionId: id.toUpperCase(), rawAnswer: "4" }] }).ok, false);
  });
  it("bounds question count, identity and answer length", () => {
    for (const bad of [{ studentNo: "210170" }, { studentNo: "90000" }, { studentName: "x".repeat(41) }, { studentName: "학생\u0000" }, { answers: [] }, { answers: Array.from({ length: 101 }, () => payload.answers[0]) }, { answers: [{ questionId, rawAnswer: "1".repeat(257) }] }]) {
      assert.equal(parseSubmissionPayload({ ...payload, ...bad }).ok, false);
    }
  });
  it("rejects nonboolean attempt flags and oversized retry tokens", () => {
    assert.equal(parseSubmissionPayload({ ...payload, isFinalAttempt: "true" }).ok, false);
    assert.equal(parseSubmissionPayload({ ...payload, retryToken: "x".repeat(2049) }).ok, false);
  });
});

describe("admin session tokens", () => {
  it("accepts a current signature and uses independent nonces", () => {
    const a = createSessionToken(secret, now);
    const b = createSessionToken(secret, now);
    assert.notEqual(a, b);
    assert.equal(verifySessionToken(a, secret, now + 1000), true);
  });
  it("rejects future-issued and expired tokens", () => {
    assert.equal(verifySessionToken(createSessionToken(secret, now + 1), secret, now), false);
    assert.equal(verifySessionToken(createSessionToken(secret, now), secret, now + sessionMaxAgeSeconds * 1000), false);
  });
  it("rejects tampering, extra segments, legacy and changed secrets", () => {
    const token = createSessionToken(secret, now);
    assert.equal(verifySessionToken(token + ".extra", secret, now), false);
    assert.equal(verifySessionToken(token, "different", now), false);
    assert.equal(verifySessionToken(`${now}.legacy`, secret, now), false);
    assert.equal(verifySessionToken(token.replace(/^1/, "2"), secret, now), false);
  });
});

describe("server-approved retry tokens", () => {
  it("accepts the matching student, quiz, and request", () => assert.equal(verifyRetryToken(createRetryToken(identity, secret, now), identity, secret, now + 1000), true));
  it("rejects forged final attempts and cross-student/quiz/request reuse", () => {
    const token = createRetryToken(identity, secret, now);
    assert.equal(verifyRetryToken(undefined, identity, secret, now), false);
    for (const other of [{ studentNo: "21018" }, { studentName: "다른이름" }, { quizSetId: questionId }, { requestId: quizSetId }]) assert.equal(verifyRetryToken(token, { ...identity, ...other }, secret, now), false);
  });
  it("expires after 30 minutes and rejects future issuance", () => {
    const token = createRetryToken(identity, secret, now);
    assert.equal(verifyRetryToken(token, identity, secret, now + 30 * 60 * 1000), false);
    assert.equal(verifyRetryToken(token, identity, secret, now - 1), false);
  });
});

describe("durable rate-limit boundary", () => {
  it("does not trust client spoofed XFF or arbitrary local headers", () => {
    assert.equal(requestIpIdentity(new Headers({ "x-forwarded-for": "1.2.3.4" }), true), "unknown-vercel-client");
    assert.equal(requestIpIdentity(new Headers({ "x-vercel-forwarded-for": "1.2.3.4" }), false), "local");
    assert.equal(requestIpIdentity(new Headers({ "x-vercel-forwarded-for": "1.2.3.4" }), true), "1.2.3.4");
  });
  it("fails closed for malformed limiter responses", () => {
    for (const bad of [null, [], {}, { allowed: "true", retry_after_seconds: 1 }, { allowed: true, retry_after_seconds: NaN }]) assert.equal(parseRateLimitDecision(bad), null);
    assert.deepEqual(parseRateLimitDecision({ allowed: false, retry_after_seconds: 3.1 }), { allowed: false, retryAfter: 4 });
  });
});
