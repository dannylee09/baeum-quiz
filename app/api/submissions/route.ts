import { NextResponse } from "next/server";
import type { AnswerType, GradedSubmission, Question, SubjectCode } from "@/lib/types";
import { gradeSubmission, shouldRequestRetry } from "@/lib/quiz/grading";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { readJsonBody, validateMutationRequest } from "@/lib/request-security";
import { parseSubmissionPayload, isRecord, isUuid } from "@/lib/security/validation";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createRetryToken, digest, verifyRetryToken } from "@/lib/security/tokens";
import { getServerSigningSecret } from "@/lib/security/server-secret";

type QuizRow = { id: string; subject_code: SubjectCode; title: string; published: boolean };
type QuestionRow = { id: string; quiz_set_id: string; question_no: number; answer_type: AnswerType; correct_answer: string; points: number };
type StoredResult = GradedSubmission & { submissionId: string; quizTitle: string; subjectName: string; maxScore: number; submittedAt: string; questionNumbers: Record<string, number> };
const subjectNames: Record<SubjectCode, string> = { korean: "국어", english: "영어", math: "수학" };

export async function POST(request: Request) {
  const blocked = validateMutationRequest(request);
  if (blocked) return blocked;
  // A whole school may share an outbound address; the narrower student limits follow.
  const ipLimited = await enforceRateLimit(request, { scope: "submission-ip", limit: 600, windowSeconds: 60 });
  if (ipLimited) return ipLimited;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = parseSubmissionPayload(body.value);
  if (!parsed.ok) return badRequest(parsed.errorMessage);
  const input = parsed.value;

  try {
    const quizLimited = await enforceRateLimit(request, { scope: "submission-student-quiz", identity: `${input.studentNo}:${input.quizSetId}`, limit: 8, windowSeconds: 600 });
    if (quizLimited) return quizLimited;
    const studentLimited = await enforceRateLimit(request, { scope: "submission-student", identity: input.studentNo, limit: 40, windowSeconds: 3600 });
    if (studentLimited) return studentLimited;

    const secret = getServerSigningSecret();
    const validRetry = verifyRetryToken(input.retryToken, input, secret);
    if ((input.isFinalAttempt || input.retryToken) && !validRetry) {
      return NextResponse.json({ errorMessage: "재도전 시간이 지났거나 정보가 바뀌었습니다. 새로고침 후 다시 제출해 주세요." }, { status: 409 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: quizData, error: quizError } = await supabase.from("quiz_sets")
      .select("id, subject_code, title, published").eq("id", input.quizSetId).eq("published", true).maybeSingle();
    if (quizError) throw new Error("Quiz lookup failed");
    if (!quizData) return badRequest("공개된 퀴즈 정보를 찾을 수 없습니다.");

    const { data: questionData, error: questionError } = await supabase.from("questions")
      .select("id, quiz_set_id, question_no, answer_type, correct_answer, points")
      .eq("quiz_set_id", input.quizSetId).order("question_no", { ascending: true }).limit(101);
    if (questionError) throw new Error("Question lookup failed");
    const rows = (questionData ?? []) as QuestionRow[];
    if (rows.length === 0 || rows.length > 100) return badRequest("문항 정보를 확인해 주세요.");
    const questions = rows.map((q): Question => ({ id: q.id, quizSetId: q.quiz_set_id, questionNo: q.question_no, answerType: q.answer_type, correctAnswer: q.correct_answer, points: q.points }));
    if (questions.length !== input.answerByQuestionId.size || questions.some((q) => !input.answerByQuestionId.has(q.id))) {
      return badRequest("문항 정보가 변경되었거나 답안이 누락되었습니다. 새로고침 후 다시 확인해 주세요.");
    }

    const graded = gradeSubmission(questions, {
      quizSetId: input.quizSetId, studentNo: input.studentNo, studentName: input.studentName,
      answers: questions.map((q) => ({ questionId: q.id, rawAnswer: input.answerByQuestionId.get(q.id)! })),
    });
    const invalidAnswer = graded.answers.find((answer) => answer.errorMessage);
    if (invalidAnswer) return badRequest(invalidAnswer.errorMessage ?? "답안 형식이 올바르지 않습니다.");
    const maxScore = questions.reduce((total, question) => total + question.points, 0);
    if (shouldRequestRetry(graded.totalScore, maxScore, input.isFinalAttempt && validRetry)) {
      return NextResponse.json({ needsRetry: true, retryToken: input.retryToken ?? createRetryToken(input, secret), message: "아직 맞지 않은 문항이 있어요. 답안을 다시 확인한 뒤 한 번 더 제출해 보세요." }, { headers: { "Cache-Control": "no-store" } });
    }

    const intent = JSON.stringify([input.quizSetId, input.studentNo, input.studentName, input.isFinalAttempt, [...input.answerByQuestionId].sort(([a], [b]) => a.localeCompare(b))]);
    const { data: submissionData, error: submissionError } = await supabase.rpc("save_quiz_submission", {
      p_request_id: input.requestId,
      p_request_fingerprint: digest(intent, secret, "submission-idempotency-v1"),
      p_quiz_set_id: input.quizSetId,
      p_student_no: input.studentNo,
      p_student_name: input.studentName,
      p_expected_questions: rows.map((q) => ({ id: q.id, question_no: q.question_no, answer_type: q.answer_type, correct_answer: q.correct_answer, points: q.points })),
      p_total_score: graded.totalScore,
      p_answers: graded.answers.map((a) => ({ question_id: a.questionId, raw_answer: a.rawAnswer, normalized_answer: a.normalizedAnswer, is_correct: a.isCorrect, score: a.score, error_message: a.errorMessage })),
    });
    if (submissionError) {
      if (submissionError.message.includes("QUIZ_CHANGED")) return NextResponse.json({ errorMessage: "제출 중 문항이 변경되었습니다. 새로고침 후 다시 확인해 주세요." }, { status: 409 });
      if (submissionError.message.includes("REQUEST_CONFLICT")) return NextResponse.json({ errorMessage: "이미 처리된 제출과 내용이 다릅니다. 새로고침 후 결과를 확인해 주세요." }, { status: 409 });
      throw new Error("Atomic submission failed");
    }
    if (!isRecord(submissionData) || !isUuid(submissionData.id) || typeof submissionData.created_at !== "string") throw new Error("Invalid submission response");
    return NextResponse.json({ result: buildStoredResult(graded, submissionData.id, submissionData.created_at, quizData as QuizRow, questions, maxScore) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ errorMessage: "제출 저장 중 오류가 발생했습니다. 입력한 답안을 유지한 채 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}

function buildStoredResult(graded: GradedSubmission, submissionId: string, submittedAt: string, quiz: QuizRow, questions: Question[], maxScore: number): StoredResult {
  return { ...graded, submissionId, quizTitle: quiz.title, subjectName: subjectNames[quiz.subject_code], maxScore, submittedAt, questionNumbers: Object.fromEntries(questions.map((q) => [q.id, q.questionNo])) };
}

function badRequest(errorMessage: string) {
  return NextResponse.json({ errorMessage }, { status: 400 });
}
