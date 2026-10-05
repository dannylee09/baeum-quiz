import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { validateMutationRequest, readJsonBody } from "@/lib/request-security";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createQuizSchema, normalizeQuizQuestions, quizDatabaseFields } from "@/lib/admin/quiz-input";
import { quizApiError, quizStorageError, refreshQuizPages } from "@/lib/admin/quiz-api";

export async function POST(request: Request) {
  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;
  if (!(await isAdminAuthenticated())) return quizApiError("관리자 인증이 필요합니다.",401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = createQuizSchema.safeParse(body.value);
  if (!parsed.success) return quizApiError("제목·설명·문항 수와 배점을 확인해 주세요. 문항은 최대 50개, 배점은 1~1000점입니다.");
  let quiz: Record<string,unknown>;
  let questions: ReturnType<typeof normalizeQuizQuestions>;
  try {
    quiz = quizDatabaseFields(parsed.data);
    questions = normalizeQuizQuestions(parsed.data.questions,parsed.data.subjectCode);
  } catch (error) { return quizApiError(error instanceof Error ? error.message : "입력값을 확인해 주세요."); }
  try {
    const { data,error } = await createAdminSupabaseClient().rpc("save_quiz_definition",{p_quiz_id:null,p_quiz:quiz,p_questions:questions});
    if (error) return quizStorageError(error.message);
    if (typeof data !== "string") return quizApiError("저장 결과를 확인하지 못했습니다.",503);
    refreshQuizPages(data);
    return NextResponse.json({quizId:data,revalidated:true},{headers:{"Cache-Control":"no-store"}});
  } catch { return quizApiError("퀴즈를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",503); }
}
