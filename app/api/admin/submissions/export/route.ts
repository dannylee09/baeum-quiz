import { isAdminAuthenticated } from "@/lib/admin-auth";
import { submissionsCsv } from "@/lib/admin/csv";
import { filterSubmissions, latestSubmissions, parseSubmissionFilters } from "@/lib/admin/submission-stats";
import { getAdminSubmissionData } from "@/lib/supabase/admin-queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ errorMessage: "관리자 인증이 필요합니다." }, { status: 401 });
  const result = await getAdminSubmissionData();
  if (result.source !== "supabase") return Response.json({ errorMessage: "제출 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const filters = parseSubmissionFilters(Object.fromEntries(params));
  const filtered = filterSubmissions(result.submissions, filters);
  const submissions = params.get("mode") === "latest" ? latestSubmissions(filtered) : filtered;
  return new Response(submissionsCsv(submissions, result.submissions), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="baeum-submissions.csv"',
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
