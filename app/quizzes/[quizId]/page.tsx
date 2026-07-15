import Link from "next/link";
import { notFound } from "next/navigation";
import QuizSubmissionForm from "@/app/quizzes/[quizId]/QuizSubmissionForm";
import { getSubjectTone } from "@/lib/mock-data";
import { getPublishedQuizWithQuestions } from "@/lib/supabase/quiz-queries";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function QuizDetailPage({ params }: Props) {
  const { quizId } = await params;
  const { quiz, source, errorMessage } = await getPublishedQuizWithQuestions(quizId);

  if (!quiz) {
    notFound();
  }

  const problemFilePath = quiz.questionFilePath ?? quiz.pdfStoragePath;
  const problemFileUrl = quiz.questionFileUrl ?? problemFilePath;
  const problemFileMimeType =
    quiz.questionFileMimeType ?? inferMimeTypeFromPath(problemFilePath);
  const problemFileName =
    quiz.questionFileOriginalName ?? problemFilePath ?? quiz.hwpFileName ?? null;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          ← 퀴즈 목록으로
        </Link>

        {source === "mock" && errorMessage ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${getSubjectTone(
                quiz.subjectCode,
              )}`}
            >
              {quiz.subjectName}
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              {quiz.title}
            </h1>
            <p className="mt-3 text-base leading-7 text-zinc-600">
              {quiz.description}
            </p>

            <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-5">
              <p className="text-sm font-semibold text-zinc-950">문제 파일 미리보기</p>
              <div className="mt-3 overflow-hidden rounded-md border border-zinc-200 bg-white">
                <ProblemFilePreview
                  fileName={problemFileName}
                  filePath={problemFilePath}
                  fileUrl={problemFileUrl}
                  mimeType={problemFileMimeType}
                />
              </div>
            </div>
          </section>

          <QuizSubmissionForm quiz={quiz} />
        </div>
      </div>
    </main>
  );
}

function ProblemFilePreview({
  fileName,
  filePath,
  fileUrl,
  mimeType,
}: {
  fileName: string | null;
  filePath: string | null;
  fileUrl: string | null;
  mimeType: string | null;
}) {
  if (!filePath || !fileUrl) {
    return (
      <div className="flex min-h-64 items-center justify-center p-6 text-center">
        <div>
          <p className="text-base font-medium text-zinc-900">
            등록된 문제 파일이 없습니다.
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            관리자 등록이 완료되면 이 영역에서 문제 파일을 확인할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  if (isPdf(filePath, mimeType)) {
    return (
      <div>
        <iframe
          src={fileUrl}
          title={fileName ?? "문제 파일 PDF"}
          className="h-[70vh] w-full bg-white"
        />
        <FileLink fileName={fileName} fileUrl={fileUrl} />
      </div>
    );
  }

  if (isImage(filePath, mimeType)) {
    return (
      <div className="bg-zinc-100">
        <img
          src={fileUrl}
          alt={fileName ?? "문제 파일 이미지"}
          className="max-h-[70vh] w-full object-contain"
        />
        <FileLink fileName={fileName} fileUrl={fileUrl} />
      </div>
    );
  }

  return (
    <div className="flex min-h-64 items-center justify-center p-6 text-center">
      <div>
        <p className="text-base font-medium text-zinc-900">
          {fileName ?? "문제 파일"}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          미리보기를 지원하지 않는 형식입니다. 아래 링크로 파일을 확인해 주세요.
        </p>
        <FileLink fileName="문제 파일 열기" fileUrl={fileUrl} />
      </div>
    </div>
  );
}

function FileLink({ fileName, fileUrl }: { fileName: string | null; fileUrl: string }) {
  return (
    <div className="border-t border-zinc-200 bg-white px-4 py-3 text-sm">
      <a
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-zinc-900 underline underline-offset-4"
      >
        {fileName ?? "문제 파일 새 창에서 열기"}
      </a>
    </div>
  );
}

function isPdf(path: string, mimeType: string | null) {
  return mimeType === "application/pdf" || path.toLowerCase().split("?")[0].endsWith(".pdf");
}

function isImage(path: string, mimeType: string | null) {
  const normalized = path.toLowerCase().split("?")[0];

  return (
    mimeType?.startsWith("image/") ||
    normalized.endsWith(".png") ||
    normalized.endsWith(".jpg") ||
    normalized.endsWith(".jpeg") ||
    normalized.endsWith(".webp")
  );
}

function inferMimeTypeFromPath(path: string | null) {
  if (!path) {
    return null;
  }

  const normalized = path.toLowerCase().split("?")[0];

  if (normalized.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (normalized.endsWith(".png")) {
    return "image/png";
  }

  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}
