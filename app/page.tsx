import Link from "next/link";
import { getSubjectTone } from "@/lib/mock-data";
import { getPublicLeaderboard } from "@/lib/public-leaderboard";
import { getPublishedQuizSets } from "@/lib/supabase/quiz-queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [quizResult, leaderboardResult] = await Promise.all([
    getPublishedQuizSets(),
    getPublicLeaderboard()
      .then((entries) => ({ entries, failed: false }))
      .catch(() => ({ entries: null, failed: true })),
  ]);
  const { quizzes, source, errorMessage } = quizResult;
  const leaderboard = leaderboardResult.entries;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-zinc-600">
            배움나눔활동 참여 플랫폼
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            배움나눔 퀴즈
          </h1>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-2xl text-base leading-7 text-zinc-600">
              국어, 영어, 수학 퀴즈를 선택해 답안을 제출하세요.
            </p>
            <Link href="/leaderboard" className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
              리더보드 보기 →
            </Link>
          </div>
        </section>

        <section aria-labelledby="home-leaderboard-title" className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
            <div>
              <p className="text-sm font-semibold text-indigo-700">이번 퀴즈 순위</p>
              <h2 id="home-leaderboard-title" className="mt-1 text-xl font-bold text-zinc-950">리더보드</h2>
              <p className="mt-1 text-sm text-zinc-600">공개된 퀴즈의 최신 점수를 합산한 상위 5명</p>
            </div>
            <Link href="/leaderboard" className="inline-flex min-h-10 items-center text-sm font-semibold text-zinc-700 hover:text-zinc-950">
              전체 순위 보기 →
            </Link>
          </div>

          {leaderboardResult.failed ? (
            <p className="px-5 py-5 text-sm text-zinc-600 sm:px-6">순위 정보를 잠시 불러오지 못했습니다.</p>
          ) : leaderboard?.length ? (
            <div className="divide-y divide-zinc-100">
              {leaderboard.slice(0, 5).map((entry, index) => (
                <div key={`${entry.rank}-${index}`} className="flex items-center gap-4 px-5 py-3 sm:px-6">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${index === 0 ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-700"}`}>
                    {entry.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
                    {entry.maskedStudentNo} · {entry.studentName}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-zinc-950">{entry.totalScore}점</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-5 text-sm text-zinc-600 sm:px-6">아직 순위에 표시할 제출 기록이 없습니다.</p>
          )}
        </section>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-950">진행 가능한 퀴즈</h2>
              <p className="mt-1 text-sm text-zinc-600">
                원하는 과목의 공개된 퀴즈를 선택해 참여할 수 있습니다.
              </p>
            </div>
            <p className="hidden text-sm text-zinc-500 sm:block">
              총 {quizzes.length}개
            </p>
          </div>

          {source === "error" && errorMessage ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {quizzes.map((quiz) => (
              <Link
                key={quiz.id}
                href={`/quizzes/${quiz.id}`}
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md"
              >
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${getSubjectTone(
                    quiz.subjectCode,
                  )}`}
                >
                  {quiz.subjectName}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-zinc-950">
                  {quiz.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {quiz.description}
                </p>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="text-zinc-500">
                    {quiz.questions.length}문항
                  </span>
                  <span className="font-semibold text-zinc-950">풀기 →</span>
                </div>
              </Link>
            ))}
          </div>

          {quizzes.length === 0 && source === "supabase" ? (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600">
              현재 공개된 퀴즈가 없습니다.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
