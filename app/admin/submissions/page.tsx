import Link from "next/link";
import SubmissionFilters from "@/app/admin/submissions/SubmissionFilters";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { filterSubmissions, formatAdminDateTime, latestSubmissions, parseSubmissionFilters, type AdminSearchParams } from "@/lib/admin/submission-stats";
import { getAdminSubmissionData } from "@/lib/supabase/admin-queries";

export const dynamic = "force-dynamic";
const pageSize = 50;

export default async function AdminSubmissionsPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  if (!(await isAdminAuthenticated())) return null;
  const { submissions, source, errorMessage } = await getAdminSubmissionData();
  if (source !== "supabase") return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{errorMessage || "제출 기록을 불러오지 못했습니다."}</p>;
  const params = await searchParams;
  const filters = parseSubmissionFilters(params);
  const mode = params.mode === "latest" ? "latest" : "all";
  const filtered = filterSubmissions(submissions, filters);
  const displayed = mode === "latest" ? latestSubmissions(filtered) : filtered;
  const latestIds = new Set(latestSubmissions(submissions).map((submission) => submission.id));
  const totalPages = Math.max(1, Math.ceil(displayed.length / pageSize));
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, totalPages)) : 1;
  const pageSubmissions = displayed.slice((page - 1) * pageSize, page * pageSize);
  const query = new URLSearchParams({ ...filters, mode });
  const pageUrl = (pageNumber: number) => `/admin/submissions?${new URLSearchParams({ ...filters, mode, page: String(pageNumber) })}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-zinc-950">제출 현황</h2><p className="mt-1 text-sm text-zinc-600">학번·퀴즈별 최신 제출에 표시가 붙습니다. 다운로드에는 검색 조건에 맞는 전체 기록이 포함됩니다.</p></div><a href={`/api/admin/submissions/export?${query}`} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold">CSV 다운로드</a></div>
      <SubmissionFilters submissions={submissions} filters={filters} path="/admin/submissions" mode={mode} />
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-600">검색 결과 {displayed.length}건 · {page} / {totalPages}쪽 · 시각은 한국 기준</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1020px] text-left text-sm"><thead className="border-b border-zinc-200 text-zinc-500"><tr>{["제출 시각", "과목", "퀴즈", "학번", "이름", "최종 점수", "통계 반영"].map((label) => <th key={label} className="py-3 pr-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-zinc-100">{pageSubmissions.map((submission) => <tr key={submission.id}><td className="py-4 pr-4">{formatAdminDateTime(submission.submittedAt)}</td><td className="py-4 pr-4">{submission.subjectName}</td><td className="py-4 pr-4">{submission.quizTitle}</td><td className="py-4 pr-4">{submission.studentNo}</td><td className="py-4 pr-4">{submission.studentName}</td><td className="py-4 pr-4 font-semibold">{submission.finalScore} / {submission.maxScore}</td><td className="py-4 pr-4">{latestIds.has(submission.id) ? <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">최신 제출</span> : <span className="text-zinc-500">이전 제출</span>}</td></tr>)}</tbody></table></div>
        {displayed.length === 0 ? <p className="mt-5 text-sm text-zinc-600">선택한 조건에 해당하는 제출 기록이 없습니다.</p> : null}
        <nav aria-label="제출 기록 페이지" className="mt-5 flex items-center gap-4">{page > 1 ? <Link href={pageUrl(page - 1)} className="text-sm font-semibold underline">이전</Link> : null}{page < totalPages ? <Link href={pageUrl(page + 1)} className="text-sm font-semibold underline">다음</Link> : null}</nav>
      </section>
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-zinc-950">문항별 답안 확인</h2><p className="mt-1 text-sm text-zinc-600">학생을 누르면 이 페이지에 표시된 제출의 답안을 펼쳐 볼 수 있습니다.</p><div className="mt-5 space-y-3">{pageSubmissions.map((submission) => <details key={submission.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-4"><summary className="cursor-pointer font-medium text-zinc-950">{submission.studentNo} {submission.studentName} · {submission.quizTitle} · {formatAdminDateTime(submission.submittedAt)}</summary><div className="mt-4 grid gap-3 md:grid-cols-2">{submission.answers.map((answer) => <div key={answer.id} className="rounded-md bg-white p-4"><p className="font-medium">{answer.questionNo}번 · {answer.finalIsCorrect ? "정답" : "오답"}</p><dl className="mt-2 space-y-1 break-all text-sm text-zinc-600"><div><dt className="inline">입력한 답: </dt><dd className="inline">{answer.rawAnswer || "미입력"}</dd></div><div><dt className="inline">채점에 사용한 답: </dt><dd className="inline">{answer.normalizedAnswer ?? "없음"}</dd></div><div><dt className="inline">최종 점수: </dt><dd className="inline">{answer.finalScore}점</dd></div></dl></div>)}</div></details>)}</div></section>
    </div>
  );
}