import Link from "next/link";
import { getPublicLeaderboard } from "@/lib/public-leaderboard";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  let entries: Awaited<ReturnType<typeof getPublicLeaderboard>>;
  try {
    entries = await getPublicLeaderboard();
  } catch {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
          순위 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          ← 퀴즈 목록으로
        </Link>
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-indigo-700">배움나눔 퀴즈</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">리더보드</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            현재 공개된 퀴즈의 학생별 최신 점수를 합산한 순위입니다. 같은 퀴즈를 여러 번 풀면 가장 최근 점수만 계산합니다. 실명은 표시하고 학번은 일부만 표시합니다.
          </p>
        </section>
        <section aria-label="학생별 퀴즈 순위" className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          {entries.length === 0 ? (
            <p className="p-6 text-sm text-zinc-600">아직 순위에 표시할 제출 기록이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                  <tr>
                    <th scope="col" className="px-5 py-3">순위</th>
                    <th scope="col" className="px-5 py-3">학생</th>
                    <th scope="col" className="px-5 py-3 text-right">누적 점수</th>
                    <th scope="col" className="px-5 py-3 text-right">참여 퀴즈</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {entries.map((entry, index) => (
                    <tr key={`${entry.rank}-${index}`}>
                      <td className="px-5 py-4 font-bold text-zinc-950">{entry.rank}</td>
                      <td className="px-5 py-4 font-medium text-zinc-800">{entry.maskedStudentNo} · {entry.studentName}</td>
                      <td className="px-5 py-4 text-right font-semibold text-zinc-950">{entry.totalScore}점</td>
                      <td className="px-5 py-4 text-right text-zinc-600">{entry.quizCount}개</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="text-xs leading-5 text-zinc-500">점수가 같으면 공동 순위로 표시합니다. 전체 학번은 공개하지 않습니다.</p>
      </div>
    </main>
  );
}
