import "server-only";

import type { AnswerType, SubjectCode } from "@/lib/types";
import { mockQuizzes, mockSubmissions, type MockSubmission } from "@/lib/mock-data";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AdminSubmissionAnswer = {
  id: string;
  questionId: string;
  questionNo: number;
  rawAnswer: string;
  normalizedAnswer: string | null;
  isCorrect: boolean;
  finalIsCorrect: boolean;
  score: number;
  finalScore: number;
  reviewStatus: string;
};

export type AdminSubmission = {
  id: string;
  quizSetId: string;
  quizTitle: string;
  subjectCode: SubjectCode;
  subjectName: string;
  studentNo: string;
  studentName: string;
  totalScore: number;
  finalScore: number;
  maxScore: number;
  submittedAt: string;
  answers: AdminSubmissionAnswer[];
};

export type AdminDataResult = {
  source: "supabase" | "mock";
  submissions: AdminSubmission[];
  errorMessage?: string;
};

export type AdminQuizListItem = {
  id: string;
  subjectCode: SubjectCode;
  subjectName: string;
  title: string;
  description: string;
  pdfStoragePath: string | null;
  questionFilePath: string | null;
  questionFileMimeType: string | null;
  questionFileOriginalName: string | null;
  published: boolean;
  questionCount: number;
  submissionCount: number;
  createdAt: string;
};

export type AdminQuizListResult = {
  source: "supabase" | "mock";
  quizzes: AdminQuizListItem[];
  errorMessage?: string;
};

export type AdminQuizEditQuestion = {
  id: string;
  questionNo: number;
  answerType: AnswerType;
  correctAnswer: string;
  points: number;
};

export type AdminQuizEditData = {
  id: string;
  subjectCode: SubjectCode;
  subjectName: string;
  title: string;
  description: string;
  pdfStoragePath: string | null;
  questionFilePath: string | null;
  questionFileMimeType: string | null;
  questionFileOriginalName: string | null;
  published: boolean;
  questions: AdminQuizEditQuestion[];
};

type QuizRow = {
  id: string;
  subject_code: SubjectCode;
  title: string;
};

type QuestionRow = {
  id: string;
  quiz_set_id: string;
  question_no: number;
  points: number;
};

type QuizEditQuestionRow = QuestionRow & {
  answer_type: AnswerType;
  correct_answer: string;
};

type SubmissionRow = {
  id: string;
  quiz_set_id: string;
  student_no: string;
  student_name: string;
  total_score: number;
  final_score: number;
  created_at: string;
};

type SubmissionAnswerRow = {
  id: string;
  submission_id: string;
  question_id: string;
  raw_answer: string;
  normalized_answer: string | null;
  is_correct: boolean;
  score: number;
  final_is_correct: boolean;
  final_score: number;
  review_status: string;
};

type QuizListRow = QuizRow & {
  description: string | null;
  pdf_storage_path: string | null;
  question_file_path: string | null;
  question_file_mime_type: string | null;
  question_file_original_name: string | null;
  published: boolean;
  created_at: string;
};

type QuizEditRow = QuizListRow;

const subjectNames: Record<SubjectCode, string> = {
  korean: "국어",
  english: "영어",
  math: "수학",
};

export async function getAdminSubmissionData(): Promise<AdminDataResult> {
  try {
    const supabase = createAdminSupabaseClient();
    const [quizResult, questionResult, submissionResult, answerResult] =
      await Promise.all([
        supabase.from("quiz_sets").select("id, subject_code, title"),
        supabase
          .from("questions")
          .select("id, quiz_set_id, question_no, points")
          .order("question_no", { ascending: true }),
        supabase
          .from("submissions")
          .select("id, quiz_set_id, student_no, student_name, total_score, final_score, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("submission_answers")
          .select(
            "id, submission_id, question_id, raw_answer, normalized_answer, is_correct, score, final_is_correct, final_score, review_status",
          ),
      ]);

    if (quizResult.error) {
      throw new Error(quizResult.error.message);
    }

    if (questionResult.error) {
      throw new Error(questionResult.error.message);
    }

    if (submissionResult.error) {
      throw new Error(submissionResult.error.message);
    }

    if (answerResult.error) {
      throw new Error(answerResult.error.message);
    }

    return {
      source: "supabase",
      submissions: mapRowsToSubmissions(
        (quizResult.data ?? []) as QuizRow[],
        (questionResult.data ?? []) as QuestionRow[],
        (submissionResult.data ?? []) as SubmissionRow[],
        (answerResult.data ?? []) as SubmissionAnswerRow[],
      ),
    };
  } catch {
    return {
      source: "mock",
      submissions: mockSubmissions.map(mapMockSubmission),
      errorMessage: "Supabase에서 관리자 제출 데이터를 읽지 못해 mock data를 표시합니다.",
    };
  }
}

export async function getAdminQuizList(): Promise<AdminQuizListResult> {
  try {
    const supabase = createAdminSupabaseClient();
    const [quizResult, questionResult, submissionResult] = await Promise.all([
      supabase
        .from("quiz_sets")
        .select(
          "id, subject_code, title, description, pdf_storage_path, question_file_path, question_file_mime_type, question_file_original_name, published, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("questions").select("quiz_set_id"),
      supabase.from("submissions").select("quiz_set_id"),
    ]);

    if (quizResult.error) {
      throw new Error(quizResult.error.message);
    }

    if (questionResult.error) {
      throw new Error(questionResult.error.message);
    }

    if (submissionResult.error) {
      throw new Error(submissionResult.error.message);
    }

    const questionCounts = countByQuizId(
      (questionResult.data ?? []) as Array<{ quiz_set_id: string }>,
    );
    const submissionCounts = countByQuizId(
      (submissionResult.data ?? []) as Array<{ quiz_set_id: string }>,
    );

    return {
      source: "supabase",
      quizzes: ((quizResult.data ?? []) as QuizListRow[]).map((quiz) => ({
        id: quiz.id,
        subjectCode: quiz.subject_code,
        subjectName: subjectNames[quiz.subject_code],
        title: quiz.title,
        description: quiz.description ?? "",
        pdfStoragePath: quiz.pdf_storage_path,
        questionFilePath: quiz.question_file_path ?? quiz.pdf_storage_path,
        questionFileMimeType: quiz.question_file_mime_type,
        questionFileOriginalName: quiz.question_file_original_name,
        published: quiz.published,
        questionCount: questionCounts.get(quiz.id) ?? 0,
        submissionCount: submissionCounts.get(quiz.id) ?? 0,
        createdAt: quiz.created_at,
      })),
    };
  } catch {
    return {
      source: "mock",
      quizzes: mockQuizzes.map((quiz) => ({
        id: quiz.id,
        subjectCode: quiz.subjectCode,
        subjectName: quiz.subjectName,
        title: quiz.title,
        description: quiz.description,
        pdfStoragePath: quiz.pdfStoragePath,
        questionFilePath: quiz.questionFilePath ?? quiz.pdfStoragePath,
        questionFileMimeType: quiz.questionFileMimeType ?? null,
        questionFileOriginalName: quiz.questionFileOriginalName ?? null,
        published: quiz.published,
        questionCount: quiz.questions.length,
        submissionCount: mockSubmissions.filter(
          (submission) => submission.quizSetId === quiz.id,
        ).length,
        createdAt: quiz.createdAt,
      })),
      errorMessage: "Supabase에서 퀴즈 목록을 읽지 못했습니다.",
    };
  }
}

export async function getAdminQuizForEdit(
  quizId: string,
): Promise<AdminQuizEditData | null> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data: quizData, error: quizError } = await supabase
      .from("quiz_sets")
      .select(
        "id, subject_code, title, description, pdf_storage_path, question_file_path, question_file_mime_type, question_file_original_name, published, created_at",
      )
      .eq("id", quizId)
      .maybeSingle();

    if (quizError || !quizData) {
      return null;
    }

    const { data: questionData, error: questionError } = await supabase
      .from("questions")
      .select("id, quiz_set_id, question_no, answer_type, correct_answer, points")
      .eq("quiz_set_id", quizId)
      .order("question_no", { ascending: true });

    if (questionError) {
      return null;
    }

    const quiz = quizData as QuizEditRow;

    return {
      id: quiz.id,
      subjectCode: quiz.subject_code,
      subjectName: subjectNames[quiz.subject_code],
      title: quiz.title,
      description: quiz.description ?? "",
      pdfStoragePath: quiz.pdf_storage_path,
      questionFilePath: quiz.question_file_path ?? quiz.pdf_storage_path,
      questionFileMimeType: quiz.question_file_mime_type,
      questionFileOriginalName: quiz.question_file_original_name,
      published: quiz.published,
      questions: ((questionData ?? []) as QuizEditQuestionRow[]).map((question) => ({
        id: question.id,
        questionNo: question.question_no,
        answerType: question.answer_type,
        correctAnswer: question.correct_answer,
        points: question.points,
      })),
    };
  } catch {
    return null;
  }
}

function mapRowsToSubmissions(
  quizzes: QuizRow[],
  questions: QuestionRow[],
  submissions: SubmissionRow[],
  answers: SubmissionAnswerRow[],
): AdminSubmission[] {
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const maxScoreByQuizId = new Map<string, number>();
  const answersBySubmissionId = new Map<string, SubmissionAnswerRow[]>();

  for (const question of questions) {
    maxScoreByQuizId.set(
      question.quiz_set_id,
      (maxScoreByQuizId.get(question.quiz_set_id) ?? 0) + question.points,
    );
  }

  for (const answer of answers) {
    const current = answersBySubmissionId.get(answer.submission_id) ?? [];
    current.push(answer);
    answersBySubmissionId.set(answer.submission_id, current);
  }

  return submissions.map((submission) => {
    const quiz = quizById.get(submission.quiz_set_id);
    const subjectCode = quiz?.subject_code ?? "korean";

    return {
      id: submission.id,
      quizSetId: submission.quiz_set_id,
      quizTitle: quiz?.title ?? "알 수 없는 퀴즈",
      subjectCode,
      subjectName: subjectNames[subjectCode],
      studentNo: submission.student_no,
      studentName: submission.student_name,
      totalScore: submission.total_score,
      finalScore: submission.final_score,
      maxScore: maxScoreByQuizId.get(submission.quiz_set_id) ?? 0,
      submittedAt: submission.created_at,
      answers: (answersBySubmissionId.get(submission.id) ?? [])
        .map((answer) => {
          const question = questionById.get(answer.question_id);

          return {
            id: answer.id,
            questionId: answer.question_id,
            questionNo: question?.question_no ?? 0,
            rawAnswer: answer.raw_answer,
            normalizedAnswer: answer.normalized_answer,
            isCorrect: answer.is_correct,
            finalIsCorrect: answer.final_is_correct,
            score: answer.score,
            finalScore: answer.final_score,
            reviewStatus: answer.review_status,
          };
        })
        .sort((a, b) => a.questionNo - b.questionNo),
    };
  });
}

function mapMockSubmission(submission: MockSubmission): AdminSubmission {
  return {
    id: submission.id,
    quizSetId: submission.quizSetId,
    quizTitle: submission.quizTitle,
    subjectCode: submission.subjectCode,
    subjectName: submission.subjectName,
    studentNo: submission.studentNo,
    studentName: submission.studentName,
    totalScore: submission.totalScore,
    finalScore: submission.finalScore,
    maxScore: submission.maxScore,
    submittedAt: submission.submittedAt,
    answers: submission.answers.map((answer) => ({
      id: answer.questionId,
      questionId: answer.questionId,
      questionNo: answer.questionNo,
      rawAnswer: answer.rawAnswer,
      normalizedAnswer: answer.normalizedAnswer,
      isCorrect: answer.isCorrect,
      finalIsCorrect: answer.finalIsCorrect,
      score: answer.score,
      finalScore: answer.finalScore,
      reviewStatus: answer.reviewStatus,
    })),
  };
}

function countByQuizId(rows: Array<{ quiz_set_id: string }>) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.quiz_set_id, (counts.get(row.quiz_set_id) ?? 0) + 1);
  }

  return counts;
}
