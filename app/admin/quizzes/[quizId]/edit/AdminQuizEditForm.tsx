"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminQuizEditData } from "@/lib/supabase/admin-queries";
import { useQuestionFileUpload } from "@/lib/uploads/use-question-file-upload";
import QuestionFileUpload from "../../QuestionFileUpload";

type Props = {
  quiz: AdminQuizEditData;
};

type ApiError = {
  errorStage?: string;
  errorMessage?: string;
  error?: {
    name?: string;
    message?: string;
  } | null;
};

const fieldClassName =
  "mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-950 outline-none placeholder:text-zinc-700 focus:border-zinc-900 disabled:text-zinc-950 disabled:opacity-100";

export default function AdminQuizEditForm({ quiz }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description);
  const [pdfStoragePath, setPdfStoragePath] = useState(
    quiz.questionFilePath ?? quiz.pdfStoragePath ?? "",
  );
  const [questionFileMimeType, setQuestionFileMimeType] = useState(
    quiz.questionFileMimeType ?? "",
  );
  const [questionFileOriginalName, setQuestionFileOriginalName] = useState(
    quiz.questionFileOriginalName ?? "",
  );
  const [published, setPublished] = useState(quiz.published);
  const upload = useQuestionFileUpload();
  const submittingRef = useRef(false);
  const [answers, setAnswers] = useState(
    quiz.questions.map((question) => ({
      id: question.id,
      questionNo: question.questionNo,
      correctAnswer: question.correctAnswer,
      points: question.points,
    })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateAnswer(index: number, correctAnswer: string) {
    setAnswers((current) =>
      current.map((answer, answerIndex) =>
        answerIndex === index ? { ...answer, correctAnswer } : answer,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const uploadedFile = await upload.ensureUploaded();
      const nextPath = uploadedFile?.path ?? pdfStoragePath;
      const nextMimeType = uploadedFile?.mimeType ?? questionFileMimeType;
      const nextOriginalName = uploadedFile?.originalName ?? questionFileOriginalName;

      const response = await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          pdfStoragePath: nextPath,
          questionFilePath: nextPath,
          questionFileMimeType: nextMimeType,
          questionFileOriginalName: nextOriginalName,
          published,
          questions: answers.map((answer) => ({
            id: answer.id,
            correctAnswer: answer.correctAnswer,
            points: answer.points,
          })),
        }),
      });
      const data = (await response.json()) as ({ ok?: boolean } & ApiError);

      if (!response.ok || !data.ok) {
        setErrorMessage(formatError(data, "퀴즈 수정 오류"));
        return;
      }

      if (uploadedFile) {
        setPdfStoragePath(uploadedFile.path);
        setQuestionFileMimeType(uploadedFile.mimeType);
        setQuestionFileOriginalName(uploadedFile.originalName);
        upload.reset();
      }

      setMessage("퀴즈를 수정했습니다.");

      try {
        router.refresh();
      } catch {
        setMessage(
          "퀴즈는 수정되었지만 화면을 갱신하지 못했습니다. 브라우저를 새로고침해 주세요.",
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "퀴즈 수정 오류가 발생했습니다.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-600">{quiz.subjectName}</p>
          <h2 className="mt-1 text-xl font-bold text-zinc-950">퀴즈 수정</h2>
        </div>
        <p className="text-sm text-zinc-600">
          {quiz.subjectCode === "math"
            ? "수학 정답은 정수 또는 분수만 허용합니다."
            : "국어/영어 정답은 1~5만 허용합니다."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">제목</span>
          <input
            required
            maxLength={200}
            disabled={isSubmitting}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClassName}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">설명</span>
          <textarea
            rows={3}
            maxLength={4000}
            disabled={isSubmitting}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={fieldClassName}
          />
        </label>

        <QuestionFileUpload upload={upload} disabled={isSubmitting} existingName={questionFileOriginalName || pdfStoragePath || undefined} />

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">
            문제 파일 링크 또는 저장 경로
          </span>
          <input
            maxLength={2000}
            disabled={isSubmitting}
            value={pdfStoragePath}
            onChange={(event) => {
              setPdfStoragePath(event.target.value);
              setQuestionFileMimeType("");
              setQuestionFileOriginalName("");
            }}
            className={fieldClassName}
            placeholder="비워두면 등록된 문제 파일 없음으로 저장"
          />
          <span className="mt-2 block text-sm text-zinc-600">
            현재 파일: {questionFileOriginalName || pdfStoragePath || "없음"}
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            type="checkbox"
            disabled={isSubmitting}
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          공개 상태
        </label>

        <div>
          <h3 className="text-base font-semibold text-zinc-950">문항별 정답</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {answers.map((answer, index) => (
              <label key={answer.id} className="block rounded-md bg-zinc-50 p-3">
                <span className="text-sm font-medium text-zinc-700">
                  {answer.questionNo}번 정답
                </span>
                <input
                  required
                  maxLength={100}
                  disabled={isSubmitting}
                  value={answer.correctAnswer}
                  onChange={(event) => updateAnswer(index, event.target.value)}
                  className={fieldClassName}
                  placeholder={quiz.subjectCode === "math" ? "예: 1/2" : "1~5"}
                />
              </label>
            ))}
          </div>
        </div>

        {message ? (
          <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </p>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSubmitting || upload.status === "checking" || upload.status === "uploading"}
            className="rounded-md bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isSubmitting ? (upload.status === "uploading" ? "문제 파일 업로드 중…" : "퀴즈 저장 중…") : "수정 저장"}
          </button>
          <button
            type="button"
            disabled={isSubmitting || upload.status === "uploading"}
            onClick={() => router.push("/admin/quizzes")}
            className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:border-zinc-900"
          >
            목록으로
          </button>
        </div>
      </form>
    </section>
  );
}

function formatError(data: ApiError, fallbackStage: string) {
  const stage = data.errorStage ?? fallbackStage;
  const message = data.errorMessage ?? "서버가 오류 원인을 반환하지 않았습니다.";
  return `${stage}: ${message}`;
}
