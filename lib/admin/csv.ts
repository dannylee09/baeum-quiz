import type { AdminSubmission } from "@/lib/supabase/admin-queries";
import { formatAdminDateTime, latestSubmissions } from "@/lib/admin/submission-stats";

export function escapeCsvCell(value: string | number) {
  let text = String(value);
  // Quoting alone does not stop spreadsheet applications from evaluating formulas.
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function submissionsCsv(submissions: AdminSubmission[], allSubmissions = submissions) {
  const latestIds = new Set(latestSubmissions(allSubmissions).map((submission) => submission.id));
  const rows: Array<Array<string | number>> = [["제출 시각 (한국)", "과목", "퀴즈", "학번", "이름", "자동 점수", "최종 점수", "만점", "통계 반영"]];
  for (const submission of submissions) rows.push([
    formatAdminDateTime(submission.submittedAt), submission.subjectName, submission.quizTitle,
    submission.studentNo, submission.studentName, submission.totalScore, submission.finalScore,
    submission.maxScore, latestIds.has(submission.id) ? "최신 제출" : "이전 제출",
  ]);
  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`;
}
