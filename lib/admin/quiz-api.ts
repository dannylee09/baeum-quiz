import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export function quizApiError(errorMessage: string, status = 400) {
  return NextResponse.json({ errorMessage }, { status, headers:{"Cache-Control":"no-store"} });
}

export function refreshQuizPages(id: string) {
  for (const path of ["/", "/admin", "/admin/quizzes", "/admin/submissions", "/admin/stats", "/admin/winners", `/quizzes/${id}`, `/admin/quizzes/${id}/edit`]) revalidatePath(path);
}

export function quizStorageError(message: string) {
  if (message.includes("GRADED_QUIZ")) return quizApiError("제출 기록이 있는 퀴즈는 삭제하거나 정답·배점을 바꿀 수 없습니다. 비공개로 전환하거나 새 퀴즈를 등록해 주세요.",409);
  if (message.includes("QUIZ_NOT_FOUND")) return quizApiError("퀴즈를 찾을 수 없습니다.",404);
  if (message.includes("INVALID_QUESTIONS")) return quizApiError("문항이 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요.",409);
  return quizApiError("저장하지 못했습니다. 입력 내용은 유지되니 잠시 후 다시 시도해 주세요.",503);
}
