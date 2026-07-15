import type { AdminSubmission } from "@/lib/supabase/admin-queries";
import { getAdminSubmissionData } from "@/lib/supabase/admin-queries";

export default async function AdminStatsPage() {
  const { submissions, source, errorMessage } = await getAdminSubmissionData();
  const subjectStats = getSubjectStats(submissions);
  const quizStats = getQuizStats(submissions);
  const questionStats = getQuestionStats(submissions);

  return (
    <div className="space-y-6">
      {source === "mock" && errorMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="전체 제출 수" value={`${submissions.length}건`} />
        <MetricCard label="참여 학생 수" value={`${getParticipantCount(submissions)}명`} />
        <MetricCard label="만점 제출 수" value={`${getPerfectCount(submissions)}건`} />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-950">과목별 제출 수</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {subjectStats.map((stat) => (
            <div
              key={stat.subjectCode}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
            >
              <p className="font-semibold text-zinc-950">{stat.subjectName}</p>
              <p className="mt-2 text-2xl font-bold text-zinc-950">
                {stat.count}건
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-950">퀴즈별 평균 점수</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="py-3 pr-4">과목</th>
                <th className="py-3 pr-4">퀴즈</th>
                <th className="py-3 pr-4">제출 수</th>
                <th className="py-3 pr-4">평균 점수</th>
                <th className="py-3 pr-4">만점 수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {quizStats.map((stat) => (
                <tr key={stat.quizSetId}>
                  <td className="py-4 pr-4 font-medium text-zinc-950">
                    {stat.subjectName}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">{stat.quizTitle}</td>
                  <td className="py-4 pr-4 text-zinc-700">{stat.count}건</td>
                  <td className="py-4 pr-4 font-semibold text-zinc-950">
                    {stat.averageScore.toFixed(1)} / {stat.maxScore}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">{stat.perfectCount}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-950">문항별 정답률</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="py-3 pr-4">과목</th>
                <th className="py-3 pr-4">퀴즈</th>
                <th className="py-3 pr-4">문항</th>
                <th className="py-3 pr-4">답안 수</th>
                <th className="py-3 pr-4">정답률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {questionStats.map((stat) => (
                <tr key={`${stat.quizSetId}-${stat.questionNo}`}>
                  <td className="py-4 pr-4 font-medium text-zinc-950">
                    {stat.subjectName}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">{stat.quizTitle}</td>
                  <td className="py-4 pr-4 text-zinc-700">{stat.questionNo}번</td>
                  <td className="py-4 pr-4 text-zinc-700">{stat.totalCount}건</td>
                  <td className="py-4 pr-4 font-semibold text-zinc-950">
                    {stat.correctRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function getParticipantCount(submissions: AdminSubmission[]) {
  return new Set(submissions.map((submission) => submission.studentNo)).size;
}

function getPerfectCount(submissions: AdminSubmission[]) {
  return submissions.filter(
    (submission) => submission.maxScore > 0 && submission.finalScore === submission.maxScore,
  ).length;
}

function getSubjectStats(submissions: AdminSubmission[]) {
  const stats = new Map<
    string,
    { subjectCode: string; subjectName: string; count: number }
  >();

  for (const submission of submissions) {
    const current = stats.get(submission.subjectCode) ?? {
      subjectCode: submission.subjectCode,
      subjectName: submission.subjectName,
      count: 0,
    };
    current.count += 1;
    stats.set(submission.subjectCode, current);
  }

  return Array.from(stats.values());
}

function getQuizStats(submissions: AdminSubmission[]) {
  const stats = new Map<
    string,
    {
      quizSetId: string;
      quizTitle: string;
      subjectName: string;
      count: number;
      totalScore: number;
      maxScore: number;
      perfectCount: number;
    }
  >();

  for (const submission of submissions) {
    const current = stats.get(submission.quizSetId) ?? {
      quizSetId: submission.quizSetId,
      quizTitle: submission.quizTitle,
      subjectName: submission.subjectName,
      count: 0,
      totalScore: 0,
      maxScore: submission.maxScore,
      perfectCount: 0,
    };
    current.count += 1;
    current.totalScore += submission.finalScore;
    current.maxScore = submission.maxScore;
    current.perfectCount += submission.finalScore === submission.maxScore ? 1 : 0;
    stats.set(submission.quizSetId, current);
  }

  return Array.from(stats.values()).map((stat) => ({
    ...stat,
    averageScore: stat.count === 0 ? 0 : stat.totalScore / stat.count,
  }));
}

function getQuestionStats(submissions: AdminSubmission[]) {
  const stats = new Map<
    string,
    {
      quizSetId: string;
      quizTitle: string;
      subjectName: string;
      questionNo: number;
      totalCount: number;
      correctCount: number;
    }
  >();

  for (const submission of submissions) {
    for (const answer of submission.answers) {
      const key = `${submission.quizSetId}-${answer.questionNo}`;
      const current = stats.get(key) ?? {
        quizSetId: submission.quizSetId,
        quizTitle: submission.quizTitle,
        subjectName: submission.subjectName,
        questionNo: answer.questionNo,
        totalCount: 0,
        correctCount: 0,
      };
      current.totalCount += 1;
      current.correctCount += answer.finalIsCorrect ? 1 : 0;
      stats.set(key, current);
    }
  }

  return Array.from(stats.values())
    .map((stat) => ({
      ...stat,
      correctRate:
        stat.totalCount === 0
          ? 0
          : Math.round((stat.correctCount / stat.totalCount) * 100),
    }))
    .sort((a, b) =>
      a.quizTitle === b.quizTitle
        ? a.questionNo - b.questionNo
        : a.quizTitle.localeCompare(b.quizTitle),
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
