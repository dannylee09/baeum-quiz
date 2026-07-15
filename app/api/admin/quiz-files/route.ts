import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const bucketName = "quiz-files";
const maxFileSize = 10 * 1024 * 1024;
const allowedMimeTypes = new Map([
  ["application/pdf", "pdf"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    return errorResponse("파일 업로드 오류", "업로드 데이터를 읽을 수 없습니다.", error, 400);
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return errorResponse("파일 업로드 오류", "업로드할 문제 파일을 선택해 주세요.", null, 400);
  }

  if (file.size > maxFileSize) {
    return errorResponse("파일 업로드 오류", "문제 파일은 10MB 이하만 업로드할 수 있습니다.", null, 400);
  }

  const extension = allowedMimeTypes.get(file.type);

  if (!extension) {
    return errorResponse("파일 업로드 오류", "PDF, PNG, JPG, WEBP 파일만 업로드할 수 있습니다.", null, 400);
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName || `question.${extension}`}`;

  try {
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.storage.from(bucketName).upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      return errorResponse("파일 업로드 오류", "문제 파일을 Storage에 업로드하지 못했습니다.", error, 500);
    }

    return NextResponse.json({
      path: storagePath,
      mimeType: file.type,
      originalName: file.name,
    });
  } catch (error) {
    return errorResponse("파일 업로드 오류", "문제 파일 업로드 중 오류가 발생했습니다.", error, 500);
  }
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      errorStage: "관리자 인증 오류",
      errorMessage: "관리자 인증이 필요합니다.",
    },
    { status: 401 },
  );
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function errorResponse(
  errorStage: string,
  errorMessage: string,
  error: unknown,
  status: number,
) {
  return NextResponse.json(
    {
      errorStage,
      errorMessage,
      error: toSafeErrorSummary(error),
    },
    { status },
  );
}

function toSafeErrorSummary(error: unknown) {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  if (typeof error === "object") {
    const value = error as { name?: unknown; message?: unknown };
    return {
      name: typeof value.name === "string" ? value.name : "Error",
      message: typeof value.message === "string" ? value.message : "Unknown error",
    };
  }

  return { name: "Error", message: String(error) };
}
