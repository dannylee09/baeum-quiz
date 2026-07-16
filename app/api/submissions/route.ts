import { NextResponse } from "next/server";
import type {
  AnswerType,
  GradedSubmission,
  Question,
  SubjectCode,
  SubmissionAnswerInput,
} from "@/lib/types";
import { gradeSubmission, shouldRequestRetry } from "@/lib/quiz/grading";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type SubmissionPayload = {
  quizSetId?: unknown;
  studentNo?: unknown;
  studentName?: unknown;
  answers?: unknown;
  isFinalAttempt?: unknown;
};

type QuizRow = {
  id: string;
  subject_code: SubjectCode;
  title: string;
  published: boolean;
};

type QuestionRow = {
  id: string;
  quiz_set_id: string;
  question_no: number;
  answer_type: AnswerType;
  correct_answer: string;
  points: number;
};

type StoredResult = GradedSubmission & {
  submissionId: string;
  quizTitle: string;
  subjectName: string;
  maxScore: number;
  submittedAt: string;
  questionNumbers: Record<string, number>;
};

const retryMessage =
  "아직 맞지 않은 문항이 있어요. 답안을 다시 확인한 뒤 한 번 더 제출해 보세요.";

const subjectNames: Record<SubjectCode, string> = {
  korean: "국어",
  english: "영어",
  math: "수학",
};

export async function POST(request: Request) {
  let payload: SubmissionPayload;

  try {
    payload = (await request.json()) as SubmissionPayload;
  } catch {
    return badRequest("제출 데이터를 읽을 수 없습니다.");
  }

  const parsed = parseSubmissionPayload(payload);

  if (!parsed.ok) {
    return badRequest(parsed.errorMessage);
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data: quizData, error: quizError } = await supabase
      .from("quiz_sets")
      .select("id, subject_code, title, published")
      .eq("id", parsed.value.quizSetId)
      .eq("published", true)
      .maybeSingle();

    if (quizError) {
      throw new Error(quizError.message);
    }

    if (!quizData) {
      return badRequest("공개된 퀴즈 정보를 찾을 수 없습니다.");
    }

    const { data: questionData, error: questionError } = await supabase
      .from("questions")
      .select("id, quiz_set_id, question_no, answer_type, correct_answer, points")
      .eq("quiz_set_id", parsed.value.quizSetId)
      .order("question_no", { ascending: true });

    if (questionError) {
      throw new Error(questionError.message);
    }

    const questions = mapQuestionRows(questionData ?? []);

    if (questions.length === 0) {
      return badRequest("저장할 문항 정보를 찾을 수 없습니다.");
    }

    const graded = gradeSubmission(questions, {
      quizSetId: parsed.value.quizSetId,
      studentNo: parsed.value.studentNo,
      studentName: parsed.value.studentName,
      answers: questions.map((question) => ({
        questionId: question.id,
        rawAnswer: parsed.value.answerByQuestionId.get(question.id) ?? "",
      })),
    });

    const invalidAnswer = graded.answers.find((answer) => answer.errorMessage);

    if (invalidAnswer) {
      return badRequest(invalidAnswer.errorMessage ?? "답안 형식이 올바르지 않습니다.");
    }

    const maxScore = questions.reduce(
      (total, question) => total + question.points,
      0,
    );

    if (
      shouldRequestRetry(
        graded.totalScore,
        maxScore,
        parsed.value.isFinalAttempt,
      )
    ) {
      return NextResponse.json({
        needsRetry: true,
        message: retryMessage,
      });
    }

    const submittedAt = new Date().toISOString();
    const { data: submissionData, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        quiz_set_id: graded.quizSetId,
        student_no: graded.studentNo,
        student_name: graded.studentName,
        total_score: graded.totalScore,
        final_score: graded.totalScore,
        graded_at: submittedAt,
      })
      .select("id, created_at")
      .single();

    if (submissionError) {
      throw new Error(submissionError.message);
    }

    const answerRows = graded.answers.map((answer) => ({
      submission_id: submissionData.id,
      question_id: answer.questionId,
      raw_answer: answer.rawAnswer,
      normalized_answer: answer.normalizedAnswer,
      is_correct: answer.isCorrect,
      score: answer.score,
      final_is_correct: answer.isCorrect,
      final_score: answer.score,
      error_message: answer.errorMessage,
      review_status: "auto",
    }));

    const { error: answerInsertError } = await supabase
      .from("submission_answers")
      .insert(answerRows);

    if (answerInsertError) {
      throw new Error(answerInsertError.message);
    }

    return NextResponse.json({
      result: buildStoredResult(
        graded,
        submissionData.id,
        submissionData.created_at ?? submittedAt,
        quizData as QuizRow,
        questions,
        maxScore,
      ),
    });
  } catch {
    return NextResponse.json(
      { errorMessage: "제출 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}

function parseSubmissionPayload(payload: SubmissionPayload) {
  const quizSetId = typeof payload.quizSetId === "string" ? payload.quizSetId.trim() : "";
  const studentNo = typeof payload.studentNo === "string" ? payload.studentNo.trim() : "";
  const studentName =
    typeof payload.studentName === "string" ? payload.studentName.trim() : "";

  if (
    payload.isFinalAttempt !== undefined &&
    typeof payload.isFinalAttempt !== "boolean"
  ) {
    return { ok: false as const, errorMessage: "제출 시도 정보가 올바르지 않습니다." };
  }

  if (!quizSetId) {
    return { ok: false as const, errorMessage: "퀴즈 정보가 올바르지 않습니다." };
  }

  if (!studentNo || !studentName) {
    return { ok: false as const, errorMessage: "학번과 이름을 입력해 주세요." };
  }

  if (!Array.isArray(payload.answers)) {
    return { ok: false as const, errorMessage: "답안 정보가 올바르지 않습니다." };
  }

  const answers: SubmissionAnswerInput[] = [];

  for (const answer of payload.answers) {
    if (!isAnswerInput(answer)) {
      return { ok: false as const, errorMessage: "답안 정보가 올바르지 않습니다." };
    }

    answers.push({
      questionId: answer.questionId.trim(),
      rawAnswer: answer.rawAnswer,
    });
  }

  return {
    ok: true as const,
    value: {
      quizSetId,
      studentNo,
      studentName,
      isFinalAttempt: payload.isFinalAttempt === true,
      answerByQuestionId: new Map(
        answers.map((answer) => [answer.questionId, answer.rawAnswer]),
      ),
    },
  };
}

function isAnswerInput(value: unknown): value is SubmissionAnswerInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const answer = value as Partial<SubmissionAnswerInput>;
  return typeof answer.questionId === "string" && typeof answer.rawAnswer === "string";
}

function mapQuestionRows(rows: QuestionRow[]): Question[] {
  return rows.map((question) => ({
    id: question.id,
    quizSetId: question.quiz_set_id,
    questionNo: question.question_no,
    answerType: question.answer_type,
    correctAnswer: question.correct_answer,
    points: question.points,
  }));
}

function buildStoredResult(
  graded: GradedSubmission,
  submissionId: string,
  submittedAt: string,
  quiz: QuizRow,
  questions: Question[],
  maxScore: number,
): StoredResult {
  return {
    ...graded,
    submissionId,
    quizTitle: quiz.title,
    subjectName: subjectNames[quiz.subject_code],
    maxScore,
    submittedAt,
    questionNumbers: Object.fromEntries(
      questions.map((question) => [question.id, question.questionNo]),
    ),
  };
}

function badRequest(errorMessage: string) {
  return NextResponse.json({ errorMessage }, { status: 400 });
}
