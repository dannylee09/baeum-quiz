import WinnerPicker from "@/app/admin/winners/WinnerPicker";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getLotteryHistory } from "@/lib/admin/lottery-store";
import { getLotteryCandidates } from "@/lib/admin/submission-stats";
import { maskStudentName, maskStudentNo } from "@/lib/mock-data";
import { getAdminSubmissionData } from "@/lib/supabase/admin-queries";

export const dynamic = "force-dynamic";

export default async function AdminWinnersPage() {
  if (!(await isAdminAuthenticated())) return null;
  const [{ submissions, source, errorMessage }, history] = await Promise.all([getAdminSubmissionData(), getLotteryHistory()]);
  if (source !== "supabase") return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{errorMessage || "참여 기록을 불러오지 못해 추첨을 중단했습니다."}</p>;
  const candidates = getLotteryCandidates(submissions);
  return <div className="space-y-6">
    {history.errorMessage ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{history.errorMessage}</p> : null}
    <WinnerPicker candidateCount={candidates.length} initialDraws={history.draws} disabled={Boolean(history.errorMessage)} />
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-zinc-950">중복을 제외한 추첨 후보</h2><p className="mt-1 text-sm text-zinc-600">과목 전체에서 학생당 한 번만 표시합니다. 만점 퀴즈 수가 많아도 당첨 확률은 같습니다.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="border-b border-zinc-200 text-zinc-500"><tr><th className="py-3 pr-4">공개 표시</th><th className="py-3 pr-4">최신 결과가 만점인 퀴즈</th><th className="py-3 pr-4">응모권</th></tr></thead><tbody className="divide-y divide-zinc-100">{candidates.map((candidate) => <tr key={candidate.studentNo}><td className="py-4 pr-4 font-medium">{maskStudentNo(candidate.studentNo)} {maskStudentName(candidate.studentName)}</td><td className="py-4 pr-4">{candidate.qualifyingQuizCount}개</td><td className="py-4 pr-4">1개</td></tr>)}</tbody></table></div>{candidates.length === 0 ? <p className="mt-4 text-sm text-zinc-600">아직 추첨 후보가 없습니다.</p> : null}</section>
  </div>;
}