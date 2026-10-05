import Link from "next/link";
import type { AdminSubmission } from "@/lib/supabase/admin-queries";
import type { SubmissionFilters as Filters } from "@/lib/admin/submission-stats";

export default function SubmissionFilters({ submissions, filters, path, mode }: { submissions: AdminSubmission[]; filters: Filters; path: string; mode?: string }) {
  const quizzes = [...new Map(submissions.map((submission) => [submission.quizSetId, { id: submission.quizSetId, title: submission.quizTitle, subject: submission.subjectName }])).values()];
  const inputClass = "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";
  return (
    <form action={path} className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <label className="text-sm font-medium text-zinc-700">과목
        <select name="subject" defaultValue={filters.subject} className={inputClass}>
          <option value="">전체 과목</option><option value="korean">국어</option><option value="english">영어</option><option value="math">수학</option>
        </select>
      </label>
      <label className="min-w-0 flex-1 text-sm font-medium text-zinc-700">퀴즈
        <select name="quiz" defaultValue={filters.quiz} className={inputClass}>
          <option value="">전체 퀴즈</option>
          {quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.subject} · {quiz.title}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-zinc-700">학생 검색
        <input name="student" defaultValue={filters.student} maxLength={50} placeholder="학번 또는 이름" className={inputClass} />
      </label>
      {mode !== undefined ? <label className="text-sm font-medium text-zinc-700">제출 범위
        <select name="mode" defaultValue={mode} className={inputClass}><option value="all">모든 제출</option><option value="latest">최신 제출만</option></select>
      </label> : null}
      <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">조회</button>
      <Link href={path} className="px-2 py-2 text-sm text-zinc-600 underline">초기화</Link>
    </form>
  );
}
