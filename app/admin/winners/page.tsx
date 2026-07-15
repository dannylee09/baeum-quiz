import WinnerPicker from "@/app/admin/winners/WinnerPicker";
import { maskStudentName, maskStudentNo } from "@/lib/mock-data";
import { getAdminSubmissionData } from "@/lib/supabase/admin-queries";

export const dynamic = "force-dynamic";

export default async function AdminWinnersPage() {
  const { submissions, source, errorMessage } = await getAdminSubmissionData();
  const perfectSubmissions = submissions.filter(
    (submission) =>
      submission.maxScore > 0 && submission.finalScore === submission.maxScore,
  );

  return (
    <div className="space-y-6">
      {source === "mock" && errorMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <WinnerPicker submissions={perfectSubmissions} />

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-950">만점자 후보 목록</h2>
        <p className="mt-1 text-sm text-zinc-600">
          공개 화면에 사용할 수 있도록 학번과 이름을 마스킹해서 표시합니다.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="py-3 pr-4">과목</th>
                <th className="py-3 pr-4">퀴즈</th>
                <th className="py-3 pr-4">공개 표시</th>
                <th className="py-3 pr-4">점수</th>
                <th className="py-3 pr-4">제출 시각</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {perfectSubmissions.map((submission) => (
                <tr key={submission.id}>
                  <td className="py-4 pr-4 font-medium text-zinc-950">
                    {submission.subjectName}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">
                    {submission.quizTitle}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">
                    {maskStudentNo(submission.studentNo)}{" "}
                    {maskStudentName(submission.studentName)}
                  </td>
                  <td className="py-4 pr-4 font-semibold text-zinc-950">
                    {submission.finalScore} / {submission.maxScore}
                  </td>
                  <td className="py-4 pr-4 text-zinc-600">
                    {formatDateTime(submission.submittedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {perfectSubmissions.length === 0 ? (
          <p className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            아직 만점자 후보가 없습니다.
          </p>
        ) : null}
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
