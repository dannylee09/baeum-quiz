const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function parseSubmissionPayload(payload: unknown) {
  if (!isRecord(payload)) return invalid("제출 데이터가 올바르지 않습니다.");
  const quizSetId = typeof payload.quizSetId === "string" ? payload.quizSetId.trim().toLowerCase() : "";
  const requestId = typeof payload.requestId === "string" ? payload.requestId.trim().toLowerCase() : "";
  const studentNo = typeof payload.studentNo === "string" ? payload.studentNo.trim() : "";
  const studentName = typeof payload.studentName === "string" ? payload.studentName.trim().normalize("NFC") : "";

  if (!isUuid(quizSetId) || !isUuid(requestId)) return invalid("퀴즈 또는 제출 정보가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.");
  if (!/^[1-3]\d{4}$/.test(studentNo)) return invalid("학번은 1~3학년의 다섯 자리 숫자로 입력해 주세요.");
  if (studentName.length < 1 || studentName.length > 40 || /[\p{Cc}\p{Cf}]/u.test(studentName)) return invalid("이름은 1~40자로 입력해 주세요.");
  if (payload.isFinalAttempt !== undefined && typeof payload.isFinalAttempt !== "boolean") return invalid("제출 시도 정보가 올바르지 않습니다.");
  if (payload.retryToken !== undefined && (typeof payload.retryToken !== "string" || payload.retryToken.length > 2048)) return invalid("재도전 정보가 올바르지 않습니다.");
  if (!Array.isArray(payload.answers) || payload.answers.length < 1 || payload.answers.length > 100) return invalid("답안은 1~100문항까지 제출할 수 있습니다.");

  const answerByQuestionId = new Map<string, string>();
  for (const answer of payload.answers) {
    if (!isRecord(answer) || !isUuid(answer.questionId) || typeof answer.rawAnswer !== "string" || answer.rawAnswer.length > 256) return invalid("답안 정보가 올바르지 않거나 너무 깁니다.");
    const questionId = answer.questionId.toLowerCase();
    if (answerByQuestionId.has(questionId)) return invalid("같은 문항의 답안을 중복 제출할 수 없습니다.");
    answerByQuestionId.set(questionId, answer.rawAnswer);
  }

  return {
    ok: true as const,
    value: { quizSetId, requestId, studentNo, studentName, isFinalAttempt: payload.isFinalAttempt === true, retryToken: payload.retryToken as string | undefined, answerByQuestionId },
  };
}

function invalid(errorMessage: string) {
  return { ok: false as const, errorMessage };
}
