import AdminQuizCreateForm from "@/app/admin/quizzes/AdminQuizCreateForm";
import AdminQuizRowActions from "@/app/admin/quizzes/AdminQuizRowActions";
import { getAdminQuizList } from "@/lib/supabase/admin-queries";

export const dynamic = "force-dynamic";

export default async function AdminQuizzesPage() {
  const { quizzes, source, errorMessage } = await getAdminQuizList();

  return (
    <div className="space-y-6">
      <AdminQuizCreateForm />

      {source === "mock" && errorMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-950">퀴즈 목록/공개 상태</h2>
        <p className="mt-1 text-sm text-zinc-600">
          실제 DB에 등록된 퀴즈와 공개 여부, 제출 수, 문제 파일 정보를 확인합니다.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="py-3 pr-4">과목</th>
                <th className="py-3 pr-4">퀴즈명</th>
                <th className="py-3 pr-4">설명</th>
                <th className="py-3 pr-4">문항</th>
                <th className="py-3 pr-4">제출</th>
                <th className="py-3 pr-4">문제 파일</th>
                <th className="py-3 pr-4">공개 상태</th>
                <th className="py-3 pr-4">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {quizzes.map((quiz) => (
                <tr key={quiz.id}>
                  <td className="py-4 pr-4 font-medium text-zinc-950">
                    {quiz.subjectName}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">{quiz.title}</td>
                  <td className="max-w-xs py-4 pr-4 text-zinc-600">
                    {quiz.description || "-"}
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">
                    {quiz.questionCount}문항
                  </td>
                  <td className="py-4 pr-4 text-zinc-700">
                    {quiz.submissionCount}건
                  </td>
                  <td className="max-w-xs py-4 pr-4 text-zinc-700">
                    <span className="line-clamp-2">
                      {quiz.questionFileOriginalName ??
                        quiz.questionFilePath ??
                        quiz.pdfStoragePath ??
                        "-"}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        quiz.published
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {quiz.published ? "공개" : "비공개"}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <AdminQuizRowActions
                      quizId={quiz.id}
                      published={quiz.published}
                      submissionCount={quiz.submissionCount}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {quizzes.length === 0 ? (
          <p className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            아직 등록된 퀴즈가 없습니다.
          </p>
        ) : null}
      </section>
    </div>
  );
}
