import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { validateMutationRequest } from "@/lib/request-security";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { readUploadFormData, UploadRequestError } from "@/lib/uploads/read-upload";
import { safeOriginalFileName, validateQuestionFileContent } from "@/lib/uploads/validation";

export async function POST(request: Request) {
  const blocked = validateMutationRequest(request);
  if (blocked) return blocked;
  if (!(await isAdminAuthenticated())) {
    return errorResponse("관리자 인증이 필요합니다. 다시 로그인해 주세요.", 401);
  }
  try {
    const formData = await readUploadFormData(request);
    const entries = [...formData.entries()];
    const file = formData.get("file");
    if (entries.length !== 1 || !(file instanceof File)) {
      return errorResponse("문제 파일 하나를 선택해 주세요.", 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = validateQuestionFileContent(file, bytes);
    if (!validated.ok) return errorResponse(validated.error, 400);
    // Use only server-generated identifiers and a content-verified extension.
    const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${validated.extension}`;
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.storage.from("quiz-files").upload(storagePath, bytes, {
      contentType: validated.mimeType,
      upsert: false,
    });
    if (error) {
      console.error("Question file storage upload failed", { name: error.name });
      return errorResponse("문제 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503);
    }
    return NextResponse.json({
      path: storagePath,
      mimeType: validated.mimeType,
      originalName: safeOriginalFileName(file.name),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UploadRequestError) return errorResponse(error.message, error.status);
    console.error("Question file upload failed", { name: error instanceof Error ? error.name : "Error" });
    return errorResponse("파일 업로드 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}

function errorResponse(errorMessage: string, status: number) {
  return NextResponse.json({ errorStage: "파일 업로드 오류", errorMessage }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
