import { NextResponse } from "next/server";
import type { SubjectCode } from "@/lib/types";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { validateMutationRequest, readJsonBody } from "@/lib/request-security";
import { isUuid } from "@/lib/security/validation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { patchQuizSchema, normalizeQuizQuestions, quizDatabaseFields } from "@/lib/admin/quiz-input";
import { quizApiError, quizStorageError, refreshQuizPages } from "@/lib/admin/quiz-api";
type Props = { params: Promise<{quizId:string}> };

export async function PATCH(request: Request, {params}: Props) {
  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;
  if (!(await isAdminAuthenticated())) return quizApiError("관리자 인증이 필요합니다.",401);
  const {quizId} = await params;
  if (!isUuid(quizId)) return quizApiError("퀴즈 정보가 올바르지 않습니다.");
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = patchQuizSchema.safeParse(body.value);
  if (!parsed.success) return quizApiError("제목·설명·문항 정보와 배점을 확인해 주세요.");
  try {
    const client = createAdminSupabaseClient();
    const {data:existing,error:readError} = await client.from("quiz_sets").select("subject_code").eq("id",quizId).maybeSingle();
    if (readError) return quizApiError("퀴즈 정보를 불러오지 못했습니다.",503);
    if (!existing) return quizApiError("퀴즈를 찾을 수 없습니다.",404);
    let quiz: Record<string,unknown>;
    let questions: ReturnType<typeof normalizeQuizQuestions> | null;
    try {
      quiz = quizDatabaseFields(parsed.data);
      questions = parsed.data.questions ? normalizeQuizQuestions(parsed.data.questions,existing.subject_code as SubjectCode) : null;
    } catch (error) { return quizApiError(error instanceof Error ? error.message : "입력값을 확인해 주세요."); }
    const {error} = await client.rpc("save_quiz_definition",{p_quiz_id:quizId,p_quiz:quiz,p_questions:questions});
    if (error) return quizStorageError(error.message);
    refreshQuizPages(quizId);
    return NextResponse.json({ok:true,revalidated:true},{headers:{"Cache-Control":"no-store"}});
  } catch { return quizApiError("수정 내용을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",503); }
}

export async function DELETE(request: Request, {params}: Props) {
  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;
  if (!(await isAdminAuthenticated())) return quizApiError("관리자 인증이 필요합니다.",401);
  const {quizId} = await params;
  if (!isUuid(quizId)) return quizApiError("퀴즈 정보가 올바르지 않습니다.");
  try {
    const {data,error} = await createAdminSupabaseClient().rpc("delete_empty_quiz",{p_quiz_id:quizId});
    if (error) return quizStorageError(error.message);
    if (!data) return quizApiError("퀴즈를 찾을 수 없습니다.",404);
    refreshQuizPages(quizId);
    return NextResponse.json({ok:true,revalidated:true});
  } catch { return quizApiError("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",503); }
}
