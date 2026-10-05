import type { AdminSubmission } from "@/lib/supabase/admin-queries";

export type SubmissionFilters = { subject: string; quiz: string; student: string };
export type AdminSearchParams = Record<string, string | string[] | undefined>;

export function parseSubmissionFilters(params: AdminSearchParams): SubmissionFilters {
  const one = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  return { subject: one("subject"), quiz: one("quiz"), student: one("student").trim().slice(0, 50) };
}

export function filterSubmissions(submissions: AdminSubmission[], filters: SubmissionFilters) {
  // Resolve a name search to student numbers first so a changed name cannot revive an older attempt.
  const matchingStudents = new Set(submissions.filter((submission) => submission.studentNo.includes(filters.student) || submission.studentName.includes(filters.student)).map((submission) => submission.studentNo.trim()));
  return submissions.filter((submission) =>
    (!filters.subject || submission.subjectCode === filters.subject) &&
    (!filters.quiz || submission.quizSetId === filters.quiz) &&
    (!filters.student || matchingStudents.has(submission.studentNo.trim())),
  );
}

function newestFirst(a: AdminSubmission, b: AdminSubmission) {
  const difference = Date.parse(b.submittedAt) - Date.parse(a.submittedAt);
  const remainder = (value: string) => Number((value.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/)?.[1] ?? "").slice(3, 9).padEnd(6, "0"));
  return (Number.isFinite(difference) ? difference : 0) || remainder(b.submittedAt) - remainder(a.submittedAt) || b.id.localeCompare(a.id);
}

export function latestSubmissions(submissions: AdminSubmission[]) {
  const latest = new Map<string, AdminSubmission>();
  for (const submission of [...submissions].sort(newestFirst)) {
    const key = JSON.stringify([submission.studentNo.trim(), submission.quizSetId]);
    if (!latest.has(key)) latest.set(key, submission);
  }
  return [...latest.values()];
}

export function isPerfectSubmission(submission: AdminSubmission) {
  return submission.maxScore > 0 && submission.finalScore === submission.maxScore;
}

export function getParticipantCount(submissions: AdminSubmission[]) {
  return new Set(submissions.map((submission) => submission.studentNo.trim())).size;
}

export type LotteryCandidate = {
  studentNo: string;
  studentName: string;
  qualifyingQuizCount: number;
  submissionIds: string[];
};

export function getLotteryCandidates(submissions: AdminSubmission[]): LotteryCandidate[] {
  const candidates = new Map<string, LotteryCandidate>();
  const latest = latestSubmissions(submissions);
  const names = new Map<string, string>();
  for (const submission of latest) {
    const studentNo = submission.studentNo.trim();
    if (!names.has(studentNo)) names.set(studentNo, submission.studentName);
    if (!isPerfectSubmission(submission) || !studentNo) continue;
    const candidate = candidates.get(studentNo) ?? {
      studentNo,
      studentName: names.get(studentNo)!,
      qualifyingQuizCount: 0,
      submissionIds: [],
    };
    candidate.qualifyingQuizCount += 1;
    candidate.submissionIds.push(submission.id);
    candidates.set(studentNo, candidate);
  }
  return [...candidates.values()].sort((a, b) => a.studentNo.localeCompare(b.studentNo));
}

export function buildSubmissionStats(submissions: AdminSubmission[]) {
  const latest = latestSubmissions(submissions);
  const subjects = new Map<string, { subjectCode: string; subjectName: string; submissionCount: number; participantCount: number }>();
  const quizzes = new Map<string, { quizSetId: string; quizTitle: string; subjectName: string; count: number; rawCount: number; totalScore: number; totalPercent: number; perfectCount: number }>();
  const questions = new Map<string, { quizSetId: string; quizTitle: string; subjectName: string; questionNo: number; totalCount: number; correctCount: number }>();
  for (const submission of latest) {
    const quiz = quizzes.get(submission.quizSetId) ?? {
      quizSetId: submission.quizSetId, quizTitle: submission.quizTitle, subjectName: submission.subjectName,
      count: 0, rawCount: 0, totalScore: 0, totalPercent: 0, perfectCount: 0,
    };
    quiz.count += 1;
    quiz.totalScore += submission.finalScore;
    quiz.totalPercent += submission.maxScore > 0 ? submission.finalScore / submission.maxScore * 100 : 0;
    quiz.perfectCount += Number(isPerfectSubmission(submission));
    quizzes.set(submission.quizSetId, quiz);
    for (const answer of submission.answers) {
      const key = JSON.stringify([submission.quizSetId, answer.questionId]);
      const question = questions.get(key) ?? { quizSetId: submission.quizSetId, quizTitle: submission.quizTitle, subjectName: submission.subjectName, questionNo: answer.questionNo, totalCount: 0, correctCount: 0 };
      question.totalCount += 1;
      question.correctCount += Number(answer.finalIsCorrect);
      questions.set(key, question);
    }
  }
  for (const submission of submissions) {
    const quiz = quizzes.get(submission.quizSetId);
    if (quiz) quiz.rawCount += 1;
    if (!subjects.has(submission.subjectCode)) subjects.set(submission.subjectCode, {
      subjectCode: submission.subjectCode, subjectName: submission.subjectName, submissionCount: 0, participantCount: 0,
    });
    subjects.get(submission.subjectCode)!.submissionCount += 1;
  }
  for (const subject of subjects.values()) {
    subject.participantCount = getParticipantCount(submissions.filter((submission) => submission.subjectCode === subject.subjectCode));
  }
  return {
    latest,
    rawCount: submissions.length,
    participantCount: getParticipantCount(submissions),
    perfectCount: latest.filter(isPerfectSubmission).length,
    eligibleStudentCount: getLotteryCandidates(submissions).length,
    subjects: [...subjects.values()],
    quizzes: [...quizzes.values()].map((quiz) => ({ ...quiz, averageScore: quiz.totalScore / quiz.count, averagePercent: quiz.totalPercent / quiz.count })),
    questions: [...questions.values()].map((question) => ({ ...question, correctRate: Math.round(question.correctCount / question.totalCount * 100) })).sort((a, b) => a.quizTitle.localeCompare(b.quizTitle, "ko") || a.questionNo - b.questionNo),
  };
}

export function formatAdminDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "시각 확인 불가" : new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(date);
}
