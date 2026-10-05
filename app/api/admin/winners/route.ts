import { isAdminAuthenticated } from "@/lib/admin-auth";
import { LotteryInputError, runLotteryDraw } from "@/lib/admin/lottery";
import { getLotteryDraw, saveLotteryDraw } from "@/lib/admin/lottery-store";
import { readJsonBody, validateMutationRequest } from "@/lib/request-security";
import { isRecord, isUuid } from "@/lib/security/validation";
import { getAdminSubmissionData } from "@/lib/supabase/admin-queries";

export async function POST(request: Request) {
  const denied = validateMutationRequest(request);
  if (denied) return denied;
  if (!(await isAdminAuthenticated())) return failure(401, "관리자 인증이 필요합니다.");
  const body = await readJsonBody(request, 1024);
  if (!body.ok) return body.response;
  const payload = body.value;
  if (!isRecord(payload) || !isUuid(payload.requestId) || typeof payload.count !== "number" || !Number.isInteger(payload.count) || payload.count < 1 || payload.count > 100) {
    return failure(400, "추첨 인원은 1~100명으로 입력해 주세요.");
  }
  try {
    const saved = await runLotteryDraw(payload.requestId, payload.count, {
      find: getLotteryDraw,
      save: saveLotteryDraw,
      loadSubmissions: async () => {
        const result = await getAdminSubmissionData();
        if (result.source !== "supabase") throw new Error("현재 참여 기록을 확인하지 못했습니다.");
        return result.submissions;
      },
    });
    return Response.json({ draw: saved }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof LotteryInputError) return failure(error.status, error.message);
    return failure(503, "추첨 결과의 저장 여부를 확인하지 못했습니다. 다시 누르면 같은 요청의 저장 결과부터 확인합니다.");
  }
}

function failure(status: number, errorMessage: string) {
  return Response.json({ errorMessage }, { status, headers: { "Cache-Control": "private, no-store" } });
}
