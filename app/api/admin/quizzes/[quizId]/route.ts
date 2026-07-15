import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { AnswerType, SubjectCode } from "@/lib/types";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { normalizeChoiceAnswer } from "@/lib/quiz/grading";
import { normalizeMathAnswer } from "@/lib/quiz/math-answer";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

type QuizPatchPayload = {
  title?: unknown;
  description?: unknown;
  pdfStoragePath?: unknown;
  questionFilePath?: unknown;
  questionFileMimeType?: unknown;
  questionFileOriginalName?: unknown;
  published?: unknown;
  questions?: unknown;
};

type QuestionPatchPayload = {
  id?: unknown;
  correctAnswer?: unknown;
  points?: unknown;
};

type ExistingQuestionRow = {
  id: string;
  question_no: number;
  answer_type: AnswerType;
  points: number;
};

type ExistingQuizRow = {
  id: string;
  subject_code: SubjectCode;
};

type ErrorStage =
  | "입력값 오류"
  | "문제 파일 경로 처리 오류"
  | "정답 형식 오류"
  | "퀴즈 수정 오류"
  | "문항 수정 오류"
  | "퀴즈 삭제 오류"
  | "공개 상태 변경 오류";

export async function PATCH(request: Request, { params }: Props) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  const { quizId } = await params;
  let payload: QuizPatchPayload;

  try {
    payload = (await request.json()) as QuizPatchPayload;
  } catch (error) {
    return errorResponse("입력값 오류", "수정 데이터를 읽을 수 없습니다.", error, 400);
  }

  const parsed = parsePatchPayload(payload);

  if (!parsed.ok) {
    return errorResponse(parsed.stage, parsed.errorMessage, null, 400);
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data: quizData, error: quizReadError } = await supabase
      .from("quiz_sets")
      .select("id, subject_code")
      .eq("id", quizId)
      .maybeSingle();

    if (quizReadError || !quizData) {
      return errorResponse(
        "퀴즈 수정 오류",
        "수정할 퀴즈를 찾을 수 없습니다.",
        quizReadError,
        404,
      );
    }

    const updatePayload: Record<string, string | boolean | null> = {};

    if (parsed.value.title !== undefined) {
      updatePayload.title = parsed.value.title;
    }

    if (parsed.value.description !== undefined) {
      updatePayload.description = parsed.value.description;
    }

    if (parsed.value.questionFilePath !== undefined) {
      updatePayload.pdf_storage_path = parsed.value.questionFilePath;
      updatePayload.question_file_path = parsed.value.questionFilePath;
    }

    if (parsed.value.questionFileMimeType !== undefined) {
      updatePayload.question_file_mime_type = parsed.value.questionFileMimeType;
    }

    if (parsed.value.questionFileOriginalName !== undefined) {
      updatePayload.question_file_original_name = parsed.value.questionFileOriginalName;
    }

    if (parsed.value.published !== undefined) {
      updatePayload.published = parsed.value.published;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: quizUpdateError } = await supabase
        .from("quiz_sets")
        .update(updatePayload)
        .eq("id", quizId);

      if (quizUpdateError) {
        return errorResponse(
          parsed.value.onlyPublished ? "공개 상태 변경 오류" : "퀴즈 수정 오류",
          parsed.value.onlyPublished
            ? "공개 상태를 변경하지 못했습니다."
            : "퀴즈 기본 정보를 수정하지 못했습니다.",
          quizUpdateError,
          500,
        );
      }
    }

    if (parsed.value.questions) {
      const existingQuestions = await getExistingQuestions(supabase, quizId);

      if (!existingQuestions.ok) {
        return errorResponse(
          "문항 수정 오류",
          "기존 문항 정보를 읽지 못했습니다.",
          existingQuestions.error,
          500,
        );
      }

      const normalizedQuestions = normalizeQuestionUpdates(
        parsed.value.questions,
        existingQuestions.questions,
        (quizData as ExistingQuizRow).subject_code,
      );

      if (!normalizedQuestions.ok) {
        return errorResponse(
          normalizedQuestions.stage,
          normalizedQuestions.errorMessage,
          null,
          400,
        );
      }

      for (const question of normalizedQuestions.questions) {
        const { error: questionUpdateError } = await supabase
          .from("questions")
          .update({
            correct_answer: question.correctAnswer,
            points: question.points,
          })
          .eq("id", question.id)
          .eq("quiz_set_id", quizId);

        if (questionUpdateError) {
          return errorResponse(
            "문항 수정 오류",
            `${question.questionNo}번 문항을 수정하지 못했습니다.`,
            questionUpdateError,
            500,
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      revalidated: revalidateQuizPaths(quizId),
    });
  } catch (error) {
    return errorResponse("퀴즈 수정 오류", "퀴즈 수정 중 오류가 발생했습니다.", error, 500);
  }
}

export async function DELETE(_request: Request, { params }: Props) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  const { quizId } = await params;

  try {
    const supabase = createAdminSupabaseClient();
    const { count, error: countError } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("quiz_set_id", quizId);

    if (countError) {
      return errorResponse(
        "퀴즈 삭제 오류",
        "제출 기록 여부를 확인하지 못했습니다.",
        countError,
        500,
      );
    }

    if ((count ?? 0) > 0) {
      return errorResponse(
        "퀴즈 삭제 오류",
        "이미 제출 기록이 있어 삭제할 수 없습니다. 대신 비공개로 전환하세요.",
        null,
        409,
      );
    }

    const { error: deleteError } = await supabase
      .from("quiz_sets")
      .delete()
      .eq("id", quizId);

    if (deleteError) {
      return errorResponse("퀴즈 삭제 오류", "퀴즈를 삭제하지 못했습니다.", deleteError, 500);
    }

    return NextResponse.json({
      ok: true,
      revalidated: revalidateQuizPaths(quizId),
    });
  } catch (error) {
    return errorResponse("퀴즈 삭제 오류", "퀴즈 삭제 중 오류가 발생했습니다.", error, 500);
  }
}

function revalidateQuizPaths(quizId: string) {
  const paths = [
    "/",
    "/admin",
    "/admin/quizzes",
    "/admin/submissions",
    "/admin/stats",
    "/admin/winners",
    `/admin/quizzes/${quizId}/edit`,
    `/quizzes/${quizId}`,
  ];
  let succeeded = true;

  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      succeeded = false;
    }
  }

  return succeeded;
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

async function getExistingQuestions(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  quizId: string,
) {
  const { data, error } = await supabase
    .from("questions")
    .select("id, question_no, answer_type, points")
    .eq("quiz_set_id", quizId)
    .order("question_no", { ascending: true });

  if (error) {
    return { ok: false as const, error };
  }

  return { ok: true as const, questions: (data ?? []) as ExistingQuestionRow[] };
}

function parsePatchPayload(payload: QuizPatchPayload) {
  const value: {
    title?: string;
    description?: string | null;
    questionFilePath?: string | null;
    questionFileMimeType?: string | null;
    questionFileOriginalName?: string | null;
    published?: boolean;
    questions?: QuestionPatchPayload[];
    onlyPublished: boolean;
  } = {
    onlyPublished: false,
  };

  if (payload.title !== undefined) {
    if (typeof payload.title !== "string" || !payload.title.trim()) {
      return { ok: false as const, stage: "입력값 오류" as const, errorMessage: "제목을 입력해 주세요." };
    }
    value.title = payload.title.trim();
  }

  if (payload.description !== undefined) {
    if (typeof payload.description !== "string") {
      return { ok: false as const, stage: "입력값 오류" as const, errorMessage: "설명 값이 올바르지 않습니다." };
    }
    value.description = payload.description.trim() || null;
  }

  if (payload.pdfStoragePath !== undefined || payload.questionFilePath !== undefined) {
    const manualPath = normalizeOptionalPath(payload.pdfStoragePath);
    const questionFilePath = normalizeOptionalPath(payload.questionFilePath);

    if (!manualPath.ok || !questionFilePath.ok) {
      return {
        ok: false as const,
        stage: "문제 파일 경로 처리 오류" as const,
        errorMessage: "문제 파일 경로 값이 올바르지 않습니다.",
      };
    }

    value.questionFilePath = questionFilePath.value ?? manualPath.value;
  }

  if (payload.questionFileMimeType !== undefined) {
    const mimeType = normalizeOptionalString(payload.questionFileMimeType);
    if (!mimeType.ok) {
      return {
        ok: false as const,
        stage: "문제 파일 경로 처리 오류" as const,
        errorMessage: "문제 파일 형식 값이 올바르지 않습니다.",
      };
    }
    value.questionFileMimeType = mimeType.value;
  }

  if (payload.questionFileOriginalName !== undefined) {
    const originalName = normalizeOptionalString(payload.questionFileOriginalName);
    if (!originalName.ok) {
      return {
        ok: false as const,
        stage: "문제 파일 경로 처리 오류" as const,
        errorMessage: "문제 파일 이름 값이 올바르지 않습니다.",
      };
    }
    value.questionFileOriginalName = originalName.value;
  }

  if (payload.published !== undefined) {
    if (typeof payload.published !== "boolean") {
      return { ok: false as const, stage: "입력값 오류" as const, errorMessage: "공개 여부 값이 올바르지 않습니다." };
    }
    value.published = payload.published;
  }

  if (payload.questions !== undefined) {
    if (!Array.isArray(payload.questions)) {
      return { ok: false as const, stage: "문항 수정 오류" as const, errorMessage: "문항 정보가 올바르지 않습니다." };
    }
    value.questions = payload.questions as QuestionPatchPayload[];
  }

  value.onlyPublished =
    value.published !== undefined &&
    value.title === undefined &&
    value.description === undefined &&
    value.questionFilePath === undefined &&
    value.questionFileMimeType === undefined &&
    value.questionFileOriginalName === undefined &&
    value.questions === undefined;

  return { ok: true as const, value };
}

function normalizeQuestionUpdates(
  questionPayloads: QuestionPatchPayload[],
  existingQuestions: ExistingQuestionRow[],
  subjectCode: SubjectCode,
) {
  const existingById = new Map(existingQuestions.map((question) => [question.id, question]));
  const answerType: AnswerType = subjectCode === "math" ? "short" : "choice";
  const questions: Array<{
    id: string;
    questionNo: number;
    correctAnswer: string;
    points: number;
  }> = [];

  for (const payload of questionPayloads) {
    if (typeof payload.id !== "string") {
      return { ok: false as const, stage: "문항 수정 오류" as const, errorMessage: "문항 ID가 올바르지 않습니다." };
    }

    const existing = existingById.get(payload.id);

    if (!existing) {
      return { ok: false as const, stage: "문항 수정 오류" as const, errorMessage: "수정할 문항을 찾을 수 없습니다." };
    }

    if (typeof payload.correctAnswer !== "string") {
      return { ok: false as const, stage: "정답 형식 오류" as const, errorMessage: `${existing.question_no}번 문항 정답을 입력해 주세요.` };
    }

    const normalized =
      answerType === "choice"
        ? normalizeChoiceAnswer(payload.correctAnswer)
        : normalizeMathAnswer(payload.correctAnswer);

    if (!normalized.ok) {
      return { ok: false as const, stage: "정답 형식 오류" as const, errorMessage: `${existing.question_no}번 문항 정답 형식이 올바르지 않습니다.` };
    }

    questions.push({
      id: existing.id,
      questionNo: existing.question_no,
      correctAnswer: normalized.value,
      points: parsePoints(payload.points, existing.points),
    });
  }

  return { ok: true as const, questions };
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

function parsePoints(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return fallback;
  }

  return value;
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
    return { name: error.name, message: error.message };
  }

  if (typeof error === "object") {
    const value = error as { name?: unknown; message?: unknown };
    return {
      name: typeof value.name === "string" ? value.name : "Error",
      message: typeof value.message === "string" ? value.message : "Unknown error",
    };
  }

  return { name: "Error", message: String(error) };
}
