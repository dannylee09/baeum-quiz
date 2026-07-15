import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeMathAnswer, stripAnswerPrefix } from "@/lib/quiz/math-answer";

describe("normalizeMathAnswer", () => {
  it("정수 답안을 정규화한다", () => {
    assert.deepEqual(normalizeMathAnswer(" 003 "), { ok: true, value: "3" });
    assert.deepEqual(normalizeMathAnswer("-0"), { ok: true, value: "0" });
  });

  it("허용된 접두어와 공백을 보정한다", () => {
    assert.deepEqual(normalizeMathAnswer("x = 2 / 4"), {
      ok: true,
      value: "1/2",
    });
    assert.deepEqual(normalizeMathAnswer("정답: -6 / 8"), {
      ok: true,
      value: "-3/4",
    });
  });

  it("분수를 약분하고 분모 1은 정수로 바꾼다", () => {
    assert.deepEqual(normalizeMathAnswer("2/4"), { ok: true, value: "1/2" });
    assert.deepEqual(normalizeMathAnswer("3/1"), { ok: true, value: "3" });
    assert.deepEqual(normalizeMathAnswer("1/-2"), { ok: true, value: "-1/2" });
  });

  it("소수, 한글 분수 표현, 대분수를 거부한다", () => {
    assert.equal(normalizeMathAnswer("0.5").ok, false);
    assert.equal(normalizeMathAnswer("2분의1").ok, false);
    assert.equal(normalizeMathAnswer("1 1/2").ok, false);
  });

  it("잘못된 분수 형식을 거부한다", () => {
    assert.equal(normalizeMathAnswer("1/0").ok, false);
    assert.equal(normalizeMathAnswer("1/2/3").ok, false);
    assert.equal(normalizeMathAnswer("").ok, false);
  });
});

describe("stripAnswerPrefix", () => {
  it("답안 접두어를 제거한다", () => {
    assert.equal(stripAnswerPrefix("답: 1/2"), "1/2");
    assert.equal(stripAnswerPrefix("정답: x= 3"), "3");
    assert.equal(stripAnswerPrefix("y = -2"), "-2");
  });
});
