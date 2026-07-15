import Link from "next/link";
import { getAdminDashboardData } from "@/lib/supabase/admin-queries";

export const dynamic = "force-dynamic";

const cards = [
  { href: "/admin/quizzes", title: "퀴즈 목록", description: "과목별 퀴즈와 공개 상태 확인" },
  { href: "/admin/submissions", title: "제출 현황", description: "학생별 점수와 수학 검토 상태 확인" },
  { href: "/admin/winners", title: "정답자 추첨", description: "실제 만점 제출 기록을 기준으로 과목별 추첨" },
  { href: "/admin/stats", title: "참여 통계", description: "참여자 수와 퀴즈별 정답률 확인" },
];

export default async function AdminDashboardPage() {
  const { stats, source, errorMessage } = await getAdminDashboardData();

  return (
    <div className="space-y-6">
      {source === "mock" && errorMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="퀴즈" value={`${stats.quizCount}개`} />
        <MetricCard label="제출" value={`${stats.submissionCount}건`} />
        <MetricCard label="참여 학생" value={`${stats.participantCount}명`} />
        <MetricCard label="정답자" value={`${stats.perfectSubmissionCount}명`} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-900"
          >
            <h2 className="text-lg font-semibold text-zinc-950">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {card.description}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-950">{value}</p>
    </div>
  );
}
