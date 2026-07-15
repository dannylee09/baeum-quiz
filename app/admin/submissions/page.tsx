import { getAdminSubmissionData } from "@/lib/supabase/admin-queries";

export default async function AdminSubmissionsPage() {
  const { submissions, source, errorMessage } = await getAdminSubmissionData();

  return (
    <div className="space-y-6">
      {source === "mock" && errorMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-950">제출 현황</h2>
        <p className="mt-1 text-sm text-zinc-600">
          관리자 화면에서는 학번과 이름을 전체 표시합니다.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="py-3 pr-4">제출 시각</th>
                <th className="py-3 pr-4">과목</th>
                <th className="py-3 pr-4">퀴즈</th>
                <th className="py-3 pr-4">학번</th>
                <th className="py-3 pr-4">이름</th>
                <th className="py-3 pr-4">자동 점수</th>
                <th className="py-3 pr-4">최종 점수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {submissions.map((submission) => (
                <tr key={submission.id}>
                  <td className="py-4 pr-4 text-zinc-600">
                    {formatDateTime(submission.submittedAt)}
                  </td>
                  <td className="py-4 pr-4 font-medium text-zinc-950">
                    {submission.subjectName}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">
                    {submission.quizTitle}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">
                    {submission.studentNo}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">
                    {submission.studentName}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">
                    {submission.totalScore} / {submission.maxScore}
                  </td>
                  <td className="py-4 pr-4 font-semibold text-zinc-950">
                    {submission.finalScore} / {submission.maxScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {submissions.length === 0 ? (
          <p className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            아직 제출 데이터가 없습니다.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-950">문항별 답안 확인</h2>
        <div className="mt-5 space-y-4">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-zinc-950">
                    {submission.studentNo} {submission.studentName}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {submission.subjectName} · {submission.quizTitle} · 최종{" "}
                    {submission.finalScore} / {submission.maxScore}점
                  </p>
                </div>
                <p className="text-sm text-zinc-500">
                  {formatDateTime(submission.submittedAt)}
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {submission.answers.map((answer) => (
                  <div key={answer.id} className="rounded-md bg-white p-4">
                    <p className="font-medium text-zinc-950">
                      {answer.questionNo}번
                    </p>
                    <dl className="mt-2 space-y-1 text-sm text-zinc-600">
                      <div>raw_answer: {answer.rawAnswer || "-"}</div>
                      <div>
                        normalized_answer: {answer.normalizedAnswer ?? "-"}
                      </div>
                      <div>
                        is_correct: {answer.isCorrect ? "true" : "false"} ·{" "}
                        score: {answer.score}
                      </div>
                      <div>
                        final_is_correct:{" "}
                        {answer.finalIsCorrect ? "true" : "false"} · final_score:{" "}
                        {answer.finalScore}
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
