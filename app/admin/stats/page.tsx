import SubmissionFilters from "@/app/admin/submissions/SubmissionFilters";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { buildSubmissionStats, filterSubmissions, parseSubmissionFilters, type AdminSearchParams } from "@/lib/admin/submission-stats";
import { getAdminSubmissionData } from "@/lib/supabase/admin-queries";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  if (!(await isAdminAuthenticated())) return null;
  const { submissions, source, errorMessage } = await getAdminSubmissionData();
  if (source !== "supabase") return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{errorMessage || "통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}</p>;
  const filters = parseSubmissionFilters(await searchParams);
  const stats = buildSubmissionStats(filterSubmissions(submissions, filters));
  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold text-zinc-950">참여 통계</h2><p className="mt-2 text-sm leading-6 text-zinc-600">같은 학생이 같은 퀴즈를 여러 번 풀면 가장 최근 제출만 점수와 정답률에 반영합니다. 전체 제출 수에는 재도전을 모두 포함합니다.</p></div>
      <SubmissionFilters submissions={submissions} filters={filters} path="/admin/stats" />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="전체 제출 수 (재도전 포함)" value={`${stats.rawCount}건`} />
        <MetricCard label="참여 학생 수" value={`${stats.participantCount}명`} />
        <MetricCard label="통계에 반영한 최신 제출" value={`${stats.latest.length}건`} />
        <MetricCard label="만점 퀴즈가 있는 학생" value={`${stats.eligibleStudentCount}명`} />
      </section>
      {stats.rawCount === 0 ? <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600">선택한 조건에 해당하는 제출 기록이 없습니다.</p> : <>
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-zinc-950">과목별 참여 현황</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">{stats.subjects.map((stat) => <div key={stat.subjectCode} className="rounded-md border border-zinc-200 bg-zinc-50 p-4"><p className="font-semibold text-zinc-950">{stat.subjectName}</p><p className="mt-2 text-2xl font-bold text-zinc-950">{stat.participantCount}명</p><p className="mt-1 text-sm text-zinc-600">전체 제출 {stat.submissionCount}건</p></div>)}</div>
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-zinc-950">퀴즈별 결과</h2><p className="mt-1 text-sm text-zinc-600">평균 점수·득점률·만점 학생 수는 학생별 최신 제출 기준입니다.</p>
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-zinc-200 text-zinc-500"><tr>{["과목", "퀴즈", "참여 학생", "전체 제출", "평균 점수", "평균 득점률", "만점 학생"].map((label) => <th key={label} className="py-3 pr-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-zinc-100">{stats.quizzes.map((stat) => <tr key={stat.quizSetId}><td className="py-4 pr-4">{stat.subjectName}</td><td className="py-4 pr-4">{stat.quizTitle}</td><td className="py-4 pr-4">{stat.count}명</td><td className="py-4 pr-4">{stat.rawCount}건</td><td className="py-4 pr-4 font-semibold">{stat.averageScore.toFixed(1)}점</td><td className="py-4 pr-4">{stat.averagePercent.toFixed(1)}%</td><td className="py-4 pr-4">{stat.perfectCount}명</td></tr>)}</tbody></table></div>
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-zinc-950">문항별 정답률</h2>
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-zinc-200 text-zinc-500"><tr>{["과목", "퀴즈", "문항", "최신 답안 수", "정답률"].map((label) => <th key={label} className="py-3 pr-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-zinc-100">{stats.questions.map((stat) => <tr key={`${stat.quizSetId}-${stat.questionNo}`}><td className="py-4 pr-4">{stat.subjectName}</td><td className="py-4 pr-4">{stat.quizTitle}</td><td className="py-4 pr-4">{stat.questionNo}번</td><td className="py-4 pr-4">{stat.totalCount}건</td><td className="py-4 pr-4 font-semibold">{stat.correctRate}%</td></tr>)}</tbody></table></div>
        </section>
      </>}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><p className="text-sm text-zinc-600">{label}</p><p className="mt-2 text-2xl font-bold text-zinc-950">{value}</p></div>;
}