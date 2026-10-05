import { z } from "zod";
import { normalizeChoiceAnswer } from "@/lib/quiz/grading";
import { normalizeMathAnswer } from "@/lib/quiz/math-answer";
import type { SubjectCode } from "@/lib/types";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const fileFields = {
  pdfStoragePath: optionalText(2000), questionFilePath: optionalText(2000),
  questionFileMimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]).nullable().optional(),
  questionFileOriginalName: optionalText(255),
};
const question = z.object({ correctAnswer: z.string().trim().min(1).max(256), points: z.number().int().min(1).max(1000).default(1) });
export const createQuizSchema = z.object({
  subjectCode: z.enum(["korean", "english", "math"]), title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(), published: z.boolean().default(false),
  ...fileFields, questions: z.array(question).min(1).max(50),
});
export const patchQuizSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(), description: z.string().trim().max(4000).optional(),
  published: z.boolean().optional(), ...fileFields,
  questions: z.array(question.extend({ id: z.string().uuid() })).min(1).max(50).optional(),
}).refine(value => Object.keys(value).length > 0, "변경할 항목이 없습니다.");

export function normalizeQuizQuestions(questions: Array<{id?: string; correctAnswer: string; points: number}>, subject: SubjectCode) {
  const ids = new Set<string>();
  return questions.map((q,index) => {
    const id = q.id?.toLowerCase();
    if (id && ids.has(id)) throw new Error("같은 문항을 중복 수정할 수 없습니다.");
    if (id) ids.add(id);
    const result = subject === "math" ? normalizeMathAnswer(q.correctAnswer) : normalizeChoiceAnswer(q.correctAnswer);
    if (!result.ok) throw new Error(`${index + 1}번 문항의 정답 형식을 확인해 주세요.`);
    return { ...(id ? {id} : {}), correct_answer: result.value, points:q.points, answer_type:subject === "math" ? "short" : "choice" };
  });
}

export function normalizeStoredFilePath(value: string | null | undefined, supabaseUrl: string | undefined): string | null | undefined {
  if (value == null) return value;
  let path = value.trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) {
    if (!supabaseUrl) throw new Error("문제 파일 주소를 확인할 수 없습니다.");
    const url = new URL(path);
    const prefix = "/storage/v1/object/public/quiz-files/";
    if (url.origin !== new URL(supabaseUrl).origin || !url.pathname.startsWith(prefix) || url.search || url.hash) throw new Error("이 사이트에 업로드한 문제 파일만 사용할 수 있습니다.");
    path = decodeURIComponent(url.pathname.slice(prefix.length));
  }
  if (path.length > 2000 || path.startsWith("/") || /[\\\u0000-\u001f?#%:]/.test(path) || path.split("/").some(part => !part || part === "." || part === "..") || !/\.(pdf|png|jpe?g|webp)$/i.test(path)) throw new Error("문제 파일 경로가 올바르지 않습니다.");
  return path;
}

export function quizDatabaseFields(input: z.infer<typeof patchQuizSchema> | z.infer<typeof createQuizSchema>) {
  const result: Record<string, unknown> = {};
  if ("subjectCode" in input) result.subject_code = input.subjectCode;
  if (input.title !== undefined) result.title = input.title;
  if (input.description !== undefined) result.description = input.description || null;
  if (input.published !== undefined) result.published = input.published;
  if (input.questionFilePath !== undefined || input.pdfStoragePath !== undefined) {
    const path = normalizeStoredFilePath(input.questionFilePath ?? input.pdfStoragePath, process.env.NEXT_PUBLIC_SUPABASE_URL);
    result.question_file_path = path ?? null;
    result.question_file_mime_type = path ? inferFileType(path) : null;
    result.question_file_original_name = path ? input.questionFileOriginalName || path.split("/").pop() : null;
  }
  return result;
}

function inferFileType(path: string) {
  const extension = path.toLowerCase().split(".").pop();
  return extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
}
