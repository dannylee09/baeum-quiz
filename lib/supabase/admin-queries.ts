import "server-only";

import type { AnswerType, SubjectCode } from "@/lib/types";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { readAllRows } from "@/lib/supabase/read-all";
import { buildSubmissionStats } from "@/lib/admin/submission-stats";
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
  source: "supabase" | "error";
  submissions: AdminSubmission[];
  errorMessage?: string;
};

export type AdminDashboardStats = {
  quizCount: number;
  submissionCount: number;
  participantCount: number;
  perfectSubmissionCount: number;
};

export type AdminDashboardResult = {
  source: "supabase" | "error";
  stats: AdminDashboardStats;
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
  source: "supabase" | "error";
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
  questionFileUrl: string | null;
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
  max_score: number | null;
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

export async function getAdminDashboardData(): Promise<AdminDashboardResult> {
  const empty = { quizCount: 0, submissionCount: 0, participantCount: 0, perfectSubmissionCount: 0 };
  if (!(await isAdminAuthenticated())) return { source: "error", stats: empty, errorMessage: "관리자 인증이 필요합니다." };
  try {
    const [result, quizzes] = await Promise.all([getAdminSubmissionData(), getAdminQuizList()]);
    if (result.source !== "supabase" || quizzes.source !== "supabase") throw new Error("Unavailable");
    const stats = buildSubmissionStats(result.submissions);
    return { source: "supabase", stats: { quizCount: quizzes.quizzes.length, submissionCount: stats.rawCount, participantCount: stats.participantCount, perfectSubmissionCount: stats.eligibleStudentCount } };
  } catch {
    return { source: "error", stats: empty, errorMessage: "통계를 불러오지 못했습니다. 잠시 후 새로고침해 주세요." };
  }
}

export async function getAdminSubmissionData(): Promise<AdminDataResult> {
  if (!(await isAdminAuthenticated())) return { source: "error", submissions: [], errorMessage: "관리자 인증이 필요합니다." };
  try {
    const client = createAdminSupabaseClient();
    const cutoff = new Date().toISOString();
    const [quizzes, questions, submissions, answers] = await Promise.all([
      readAllRows<QuizRow>(client, "quiz_sets", "id, subject_code, title", cutoff),
      readAllRows<QuestionRow>(client, "questions", "id, quiz_set_id, question_no, points", cutoff),
      readAllRows<SubmissionRow>(client, "submissions", "id, quiz_set_id, student_no, student_name, total_score, final_score, max_score, created_at", cutoff),
      readAllRows<SubmissionAnswerRow>(client, "submission_answers", "id, submission_id, question_id, raw_answer, normalized_answer, is_correct, score, final_is_correct, final_score, review_status", cutoff),
    ]);
    return { source: "supabase", submissions: mapRowsToSubmissions(quizzes, questions, submissions, answers).sort((a,b) => b.submittedAt.localeCompare(a.submittedAt) || b.id.localeCompare(a.id)) };
  } catch {
    return { source: "error", submissions: [], errorMessage: "제출 기록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요." };
  }
}

export async function getAdminQuizList(): Promise<AdminQuizListResult> {
  if (!(await isAdminAuthenticated())) return { source: "error", quizzes: [], errorMessage: "관리자 인증이 필요합니다." };
  try {
    const client = createAdminSupabaseClient();
    const cutoff = new Date().toISOString();
    const [quizzes, questions, submissions] = await Promise.all([
      readAllRows<QuizListRow>(client, "quiz_sets", "id, subject_code, title, description, pdf_storage_path, question_file_path, question_file_mime_type, question_file_original_name, published, created_at", cutoff),
      readAllRows<{ id: string; quiz_set_id: string }>(client, "questions", "id, quiz_set_id", cutoff),
      readAllRows<{ id: string; quiz_set_id: string }>(client, "submissions", "id, quiz_set_id", cutoff),
    ]);
    const questionCounts = countByQuizId(questions);
    const submissionCounts = countByQuizId(submissions);
    return { source: "supabase", quizzes: quizzes.sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).map(quiz => ({
      id: quiz.id, subjectCode: quiz.subject_code, subjectName: subjectNames[quiz.subject_code], title: quiz.title,
      description: quiz.description ?? "", pdfStoragePath: quiz.pdf_storage_path,
      questionFilePath: quiz.question_file_path ?? quiz.pdf_storage_path, questionFileMimeType: quiz.question_file_mime_type,
      questionFileOriginalName: quiz.question_file_original_name, published: quiz.published,
      questionCount: questionCounts.get(quiz.id) ?? 0, submissionCount: submissionCounts.get(quiz.id) ?? 0, createdAt: quiz.created_at,
    })) };
  } catch {
    return { source: "error", quizzes: [], errorMessage: "퀴즈 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요." };
  }
}

export async function getAdminQuizForEdit(
  quizId: string,
): Promise<AdminQuizEditData | null> {
  if (!(await isAdminAuthenticated())) return null;
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
    const questionFilePath = quiz.question_file_path ?? quiz.pdf_storage_path;
    const questionFileUrl = !questionFilePath ? null
      : /^https?:\/\//i.test(questionFilePath) ? questionFilePath
      : supabase.storage.from("quiz-files").getPublicUrl(questionFilePath).data.publicUrl;

    return {
      id: quiz.id,
      subjectCode: quiz.subject_code,
      subjectName: subjectNames[quiz.subject_code],
      title: quiz.title,
      description: quiz.description ?? "",
      pdfStoragePath: quiz.pdf_storage_path,
      questionFilePath,
      questionFileUrl,
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
      maxScore: submission.max_score ?? maxScoreByQuizId.get(submission.quiz_set_id) ?? 0,
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

function countByQuizId(rows: Array<{ quiz_set_id: string }>) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.quiz_set_id, (counts.get(row.quiz_set_id) ?? 0) + 1);
  }

  return counts;
}
