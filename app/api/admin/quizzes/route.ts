import { NextResponse } from "next/server";
import type { AnswerType, SubjectCode } from "@/lib/types";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { normalizeChoiceAnswer } from "@/lib/quiz/grading";
import { normalizeMathAnswer } from "@/lib/quiz/math-answer";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type QuizCreatePayload = {
  subjectCode?: unknown;
  title?: unknown;
  description?: unknown;
  published?: unknown;
  pdfStoragePath?: unknown;
  questionFilePath?: unknown;
  questionFileMimeType?: unknown;
  questionFileOriginalName?: unknown;
  questions?: unknown;
};

type QuestionPayload = {
  correctAnswer?: unknown;
  points?: unknown;
};

type ParsedQuestion = {
  questionNo: number;
  answerType: AnswerType;
  correctAnswer: string;
  points: number;
};

type ErrorStage =
  | "입력값 오류"
  | "문제 파일 경로 처리 오류"
  | "정답 형식 오류"
  | "퀴즈 저장 오류"
  | "문항 저장 오류"
  | "등록 오류";

const subjectCodes = new Set<SubjectCode>(["korean", "english", "math"]);

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  let payload: QuizCreatePayload;

  try {
    payload = (await request.json()) as QuizCreatePayload;
  } catch (error) {
    return errorResponse("입력값 오류", "등록 데이터를 읽을 수 없습니다.", error, 400);
  }

  const parsed = parseQuizPayload(payload);

  if (!parsed.ok) {
    return errorResponse(parsed.stage, parsed.errorMessage, null, 400);
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data: quizData, error: quizError } = await supabase
      .from("quiz_sets")
      .insert({
        subject_code: parsed.value.subjectCode,
        title: parsed.value.title,
        description: parsed.value.description,
        pdf_storage_path: parsed.value.questionFilePath,
        question_file_path: parsed.value.questionFilePath,
        question_file_mime_type: parsed.value.questionFileMimeType,
        question_file_original_name: parsed.value.questionFileOriginalName,
        published: parsed.value.published,
      })
      .select("id")
      .single();

    if (quizError) {
      return errorResponse(
        "퀴즈 저장 오류",
        getDatabaseMessage(quizError.message, "퀴즈 기본 정보를 저장하지 못했습니다."),
        quizError,
        500,
      );
    }

    const questionRows = parsed.value.questions.map((question) => ({
      quiz_set_id: quizData.id,
      question_no: question.questionNo,
      answer_type: question.answerType,
      correct_answer: question.correctAnswer,
      points: question.points,
    }));

    const { error: questionError } = await supabase.from("questions").insert(questionRows);

    if (questionError) {
      return errorResponse(
        "문항 저장 오류",
        "문항 정보를 저장하지 못했습니다.",
        questionError,
        500,
      );
    }

    return NextResponse.json({ quizId: quizData.id });
  } catch (error) {
    return errorResponse("등록 오류", "퀴즈 등록 중 오류가 발생했습니다.", error, 500);
  }
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      errorStage: "관리자 인증 오류",
      errorMessage: "관리자 인증이 필요합니다.",
    },
    { status: 401 },
  );
}

function parseQuizPayload(payload: QuizCreatePayload) {
  const subjectCode =
    typeof payload.subjectCode === "string" ? payload.subjectCode.trim() : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description =
    typeof payload.description === "string" ? payload.description.trim() : "";
  const manualPath = normalizeOptionalPath(payload.pdfStoragePath);
  const uploadedPath = normalizeOptionalPath(payload.questionFilePath);
  const mimeType = normalizeOptionalString(payload.questionFileMimeType);
  const originalName = normalizeOptionalString(payload.questionFileOriginalName);
  const published = payload.published === true;

  if (!manualPath.ok || !uploadedPath.ok) {
    return {
      ok: false as const,
      stage: "문제 파일 경로 처리 오류" as const,
      errorMessage: "문제 파일 경로 값이 올바르지 않습니다.",
    };
  }

  if (!mimeType.ok || !originalName.ok) {
    return {
      ok: false as const,
      stage: "문제 파일 경로 처리 오류" as const,
      errorMessage: "문제 파일 정보가 올바르지 않습니다.",
    };
  }

  if (!subjectCodes.has(subjectCode as SubjectCode)) {
    return {
      ok: false as const,
      stage: "입력값 오류" as const,
      errorMessage: "과목을 선택해 주세요.",
    };
  }

  if (!title) {
    return {
      ok: false as const,
      stage: "입력값 오류" as const,
      errorMessage: "퀴즈 제목을 입력해 주세요.",
    };
  }

  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    return {
      ok: false as const,
      stage: "입력값 오류" as const,
      errorMessage: "문항을 1개 이상 입력해 주세요.",
    };
  }

  if (payload.questions.length > 50) {
    return {
      ok: false as const,
      stage: "입력값 오류" as const,
      errorMessage: "문항은 최대 50개까지 등록할 수 있습니다.",
    };
  }

  const answerType: AnswerType = subjectCode === "math" ? "short" : "choice";
  const questions: ParsedQuestion[] = [];

  for (const [index, rawQuestion] of payload.questions.entries()) {
    if (!isQuestionPayload(rawQuestion)) {
      return {
        ok: false as const,
        stage: "정답 형식 오류" as const,
        errorMessage: "문항 정답 정보가 올바르지 않습니다.",
      };
    }

    const rawCorrectAnswer = rawQuestion.correctAnswer.trim();
    const normalized =
      answerType === "choice"
        ? normalizeChoiceAnswer(rawCorrectAnswer)
        : normalizeMathAnswer(rawCorrectAnswer);

    if (!normalized.ok) {
      return {
        ok: false as const,
        stage: "정답 형식 오류" as const,
        errorMessage: `${index + 1}번 문항 정답 형식이 올바르지 않습니다.`,
      };
    }

    questions.push({
      questionNo: index + 1,
      answerType,
      correctAnswer: normalized.value,
      points: parsePoints(rawQuestion.points),
    });
  }

  const questionFilePath = uploadedPath.value ?? manualPath.value;

  return {
    ok: true as const,
    value: {
      subjectCode: subjectCode as SubjectCode,
      title,
      description: description || null,
      questionFilePath,
      questionFileMimeType: questionFilePath ? mimeType.value : null,
      questionFileOriginalName: questionFilePath ? originalName.value : null,
      published,
      questions,
    },
  };
}

function normalizeOptionalPath(value: unknown) {
  if (value === undefined || value === null) {
    return { ok: true as const, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false as const, value: null };
  }

  const trimmed = value.trim();
  return { ok: true as const, value: trimmed || null };
}

function normalizeOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return { ok: true as const, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false as const, value: null };
  }

  const trimmed = value.trim();
  return { ok: true as const, value: trimmed || null };
}

function isQuestionPayload(value: unknown): value is QuestionPayload & {
  correctAnswer: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const question = value as QuestionPayload;
  return typeof question.correctAnswer === "string";
}

function parsePoints(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return 1;
  }

  return value;
}

function getDatabaseMessage(message: string, fallback: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("duplicate") || lowerMessage.includes("unique")) {
    return "이미 같은 제목의 퀴즈가 있습니다.";
  }

  return fallback;
}

function errorResponse(
  errorStage: ErrorStage,
  errorMessage: string,
  error: unknown,
  status: number,
) {
  return NextResponse.json(
    {
      errorStage,
      errorMessage,
      error: toSafeErrorSummary(error),
    },
    { status },
  );
}

function toSafeErrorSummary(error: unknown) {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (typeof error === "object") {
    const value = error as { name?: unknown; message?: unknown };

    return {
      name: typeof value.name === "string" ? value.name : "Error",
      message: typeof value.message === "string" ? value.message : "Unknown error",
    };
  }

  return {
    name: "Error",
    message: String(error),
  };
}
