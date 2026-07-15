export type NormalizedMathAnswer =
  | {
      ok: true;
      value: string;
    }
  | {
      ok: false;
      error: string;
    };

const INTEGER_PATTERN = /^-?\d+$/;
const FRACTION_PATTERN = /^-?\d+\/-?\d+$/;
const MIXED_FRACTION_PATTERN = /^-?\d+\s+\d+\/-?\d+$/;
const ZERO = BigInt(0);
const ONE = BigInt(1);

export function normalizeMathAnswer(input: string): NormalizedMathAnswer {
  const withoutPrefix = stripAnswerPrefix(input);

  if (MIXED_FRACTION_PATTERN.test(withoutPrefix.trim())) {
    return {
      ok: false,
      error: "대분수는 허용하지 않습니다. 정수 또는 분수 형태로 입력해 주세요.",
    };
  }

  const value = withoutPrefix.replace(/\s+/g, "");

  if (value.length === 0) {
    return {
      ok: false,
      error: "답안을 입력해 주세요.",
    };
  }

  if (value.includes(".") || value.includes(",")) {
    return {
      ok: false,
      error: "소수는 허용하지 않습니다. 정수 또는 분수 형태로 입력해 주세요.",
    };
  }

  if (INTEGER_PATTERN.test(value)) {
    return { ok: true, value: normalizeInteger(value) };
  }

  if (!FRACTION_PATTERN.test(value)) {
    return {
      ok: false,
      error: "정수 또는 a/b 형태의 분수만 입력할 수 있습니다.",
    };
  }

  const [rawNumerator, rawDenominator] = value.split("/");
  const numerator = BigInt(rawNumerator);
  const denominator = BigInt(rawDenominator);

  if (denominator === ZERO) {
    return {
      ok: false,
      error: "분모는 0이 될 수 없습니다.",
    };
  }

  return { ok: true, value: reduceFraction(numerator, denominator) };
}

export function stripAnswerPrefix(input: string): string {
  let value = input.trim();

  for (;;) {
    const next = value.replace(/^(?:[xy]\s*=|정답\s*:|답\s*:)\s*/i, "");
    if (next === value) {
      return value;
    }
    value = next.trim();
  }
}

function normalizeInteger(value: string): string {
  return BigInt(value).toString();
}

function reduceFraction(numerator: bigint, denominator: bigint): string {
  if (numerator === ZERO) {
    return "0";
  }

  let nextNumerator = numerator;
  let nextDenominator = denominator;

  if (nextDenominator < ZERO) {
    nextNumerator = -nextNumerator;
    nextDenominator = -nextDenominator;
  }

  const divisor = gcd(abs(nextNumerator), nextDenominator);
  nextNumerator = nextNumerator / divisor;
  nextDenominator = nextDenominator / divisor;

  if (nextDenominator === ONE) {
    return nextNumerator.toString();
  }

  return `${nextNumerator.toString()}/${nextDenominator.toString()}`;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a;
  let y = b;

  while (y !== ZERO) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }

  return x;
}

function abs(value: bigint): bigint {
  return value < ZERO ? -value : value;
}
