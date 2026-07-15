import "server-only";

import type { AnswerType, Question, SubjectCode } from "@/lib/types";
import { getMockQuiz, mockQuizzes, type MockQuiz } from "@/lib/mock-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type DataSource = "supabase" | "mock";

type QuizQueryResult = {
  source: DataSource;
  quizzes: MockQuiz[];
  errorMessage?: string;
};

type QuizDetailQueryResult = {
  source: DataSource;
  quiz: MockQuiz | null;
  errorMessage?: string;
  unavailableReason?: "unpublished";
};

type QuizSetRow = {
  id: string;
  subject_code: SubjectCode;
  title: string;
  description: string | null;
  source_url: string | null;
  hwp_file_name: string | null;
  pdf_storage_path: string | null;
  question_file_path: string | null;
  question_file_mime_type: string | null;
  question_file_original_name: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
};

type QuestionRow = {
  id: string;
  quiz_set_id: string;
  question_no: number;
  answer_type: AnswerType;
  correct_answer: string;
  points: number;
};

const quizSetSelect =
  "id, subject_code, title, description, source_url, hwp_file_name, pdf_storage_path, question_file_path, question_file_mime_type, question_file_original_name, published, created_at, updated_at";

const subjectNames: Record<SubjectCode, string> = {
  korean: "국어",
  english: "영어",
  math: "수학",
};

export async function getPublishedQuizSets(): Promise<QuizQueryResult> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("quiz_sets")
      .select(quizSetSelect)
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const quizRows = (data ?? []) as QuizSetRow[];
    const questionCounts = await getQuestionCounts(quizRows.map((quiz) => quiz.id));

    return {
      source: "supabase",
      quizzes: quizRows.map((quiz) =>
        mapQuizSetRowToQuiz(quiz, buildPlaceholderQuestions(quiz.id, questionCounts.get(quiz.id) ?? 0)),
      ),
    };
  } catch {
    return {
      source: "mock",
      quizzes: mockQuizzes.filter((quiz) => quiz.published),
      errorMessage: "DB 조회 실패로 임시 퀴즈 목록을 표시 중입니다.",
    };
  }
}

export async function getPublishedQuizWithQuestions(
  quizId: string,
): Promise<QuizDetailQueryResult> {
  try {
    const supabase = createServerSupabaseClient();
    const { data: quizData, error: quizError } = await supabase
      .from("quiz_sets")
      .select(quizSetSelect)
      .eq("id", quizId)
      .maybeSingle();

    if (quizError) {
      throw new Error(quizError.message);
    }

    if (!quizData) {
      return {
        source: "supabase",
        quiz: null,
      };
    }

    const quizRow = quizData as QuizSetRow;

    if (!quizRow.published) {
      return {
        source: "supabase",
        quiz: null,
        unavailableReason: "unpublished",
      };
    }

    const { data: questionData, error: questionError } = await supabase
      .from("questions")
      .select("id, quiz_set_id, question_no, answer_type, correct_answer, points")
      .eq("quiz_set_id", quizId)
      .order("question_no", { ascending: true });

    if (questionError) {
      throw new Error(questionError.message);
    }

    return {
      source: "supabase",
      quiz: mapQuizSetRowToQuiz(quizRow, mapQuestionRows(questionData ?? [])),
    };
  } catch {
    const fallback = getMockQuiz(quizId);

    return {
      source: "mock",
      quiz: fallback ?? null,
      errorMessage: fallback
        ? "DB 조회 실패로 임시 퀴즈 정보를 표시 중입니다."
        : "DB에서 퀴즈 상세 정보를 읽지 못했습니다.",
    };
  }
}

async function getQuestionCounts(quizIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (quizIds.length === 0) {
    return counts;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("questions")
    .select("quiz_set_id")
    .in("quiz_set_id", quizIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as Array<{ quiz_set_id: string }>) {
    counts.set(row.quiz_set_id, (counts.get(row.quiz_set_id) ?? 0) + 1);
  }

  return counts;
}

function mapQuizSetRowToQuiz(quiz: QuizSetRow, questions: Question[]): MockQuiz {
  const questionFilePath = quiz.question_file_path ?? quiz.pdf_storage_path;
  const questionFileMimeType =
    quiz.question_file_mime_type ?? inferMimeTypeFromPath(questionFilePath);

  return {
    id: quiz.id,
    subjectCode: quiz.subject_code,
    subjectName: subjectNames[quiz.subject_code],
    title: quiz.title,
    description: quiz.description ?? "",
    sourceUrl: quiz.source_url,
    hwpFileName: quiz.hwp_file_name,
    pdfStoragePath: quiz.pdf_storage_path,
    questionFilePath,
    questionFileMimeType,
    questionFileOriginalName: quiz.question_file_original_name,
    questionFileUrl: getQuestionFileUrl(questionFilePath),
    published: quiz.published,
    createdAt: quiz.created_at,
    updatedAt: quiz.updated_at,
    questions,
  };
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

function buildPlaceholderQuestions(quizSetId: string, count: number): Question[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${quizSetId}-placeholder-${index + 1}`,
    quizSetId,
    questionNo: index + 1,
    answerType: "choice",
    correctAnswer: "",
    points: 1,
  }));
}

function getQuestionFileUrl(path: string | null) {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const supabase = createServerSupabaseClient();
  return supabase.storage.from("quiz-files").getPublicUrl(path).data.publicUrl;
}

function inferMimeTypeFromPath(path: string | null) {
  if (!path) {
    return null;
  }

  const normalized = path.toLowerCase().split("?")[0];

  if (normalized.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (normalized.endsWith(".png")) {
    return "image/png";
  }

  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}
