import Link from "next/link";
import { mockQuizzes, mockSubmissions } from "@/lib/mock-data";

const cards = [
  { href: "/admin/quizzes", title: "퀴즈 목록", description: "과목별 퀴즈와 공개 상태 확인" },
  { href: "/admin/submissions", title: "제출 현황", description: "학생별 점수와 수학 검토 상태 확인" },
  { href: "/admin/winners", title: "정답자 추첨", description: "과목별 만점자 중 mock 추첨" },
  { href: "/admin/stats", title: "참여 통계", description: "참여자 수와 퀴즈별 정답률 확인" },
];

export default function AdminDashboardPage() {
  const participantCount = new Set(
    mockSubmissions.map((submission) => submission.studentNo),
  ).size;
  const fullScoreCount = mockSubmissions.filter(
    (submission) => submission.finalScore === submission.maxScore,
  ).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="퀴즈" value={`${mockQuizzes.length}개`} />
        <MetricCard label="제출" value={`${mockSubmissions.length}건`} />
        <MetricCard label="참여 학생" value={`${participantCount}명`} />
        <MetricCard label="정답자" value={`${fullScoreCount}명`} />
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
