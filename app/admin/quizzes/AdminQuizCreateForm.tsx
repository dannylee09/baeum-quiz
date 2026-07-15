"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SubjectCode } from "@/lib/types";

type UploadedQuestionFile = {
  path: string;
  mimeType: string;
  originalName: string;
};

type ApiError = {
  errorStage?: string;
  errorMessage?: string;
  error?: {
    name?: string;
    message?: string;
  } | null;
};

const subjectOptions: Array<{ value: SubjectCode; label: string }> = [
  { value: "korean", label: "국어" },
  { value: "english", label: "영어" },
  { value: "math", label: "수학" },
];

const fieldClassName =
  "mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-950 outline-none placeholder:text-zinc-700 focus:border-zinc-900 disabled:text-zinc-950 disabled:opacity-100";

const fileFieldClassName =
  "mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-950 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white";

const maxFileSize = 10 * 1024 * 1024;

export default function AdminQuizCreateForm() {
  const router = useRouter();
  const [subjectCode, setSubjectCode] = useState<SubjectCode>("korean");
  const [questionCount, setQuestionCount] = useState(2);
  const [answers, setAnswers] = useState<string[]>(["", ""]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const answerHelp = useMemo(
    () =>
      subjectCode === "math"
        ? "수학 정답은 정수 또는 분수만 입력합니다. 예: 3, -2, 1/2"
        : "국어/영어 정답은 1~5 중 하나만 입력합니다.",
    [subjectCode],
  );

  function updateQuestionCount(nextCount: number) {
    const count = Math.min(Math.max(nextCount, 1), 50);
    setQuestionCount(count);
    setAnswers((current) =>
      Array.from({ length: count }, (_, index) => current[index] ?? ""),
    );
  }

  function updateAnswer(index: number, value: string) {
    setAnswers((current) =>
      current.map((answer, answerIndex) =>
        answerIndex === index ? value : answer,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(form);

    try {
      const uploadedFile = await uploadSelectedQuestionFile(formData.get("questionFile"));

      const response = await fetch("/api/admin/quizzes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subjectCode,
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
          pdfStoragePath: String(formData.get("pdfStoragePath") ?? ""),
          questionFilePath: uploadedFile?.path ?? null,
          questionFileMimeType: uploadedFile?.mimeType ?? null,
          questionFileOriginalName: uploadedFile?.originalName ?? null,
          published: formData.get("published") === "on",
          questions: answers.map((answer) => ({
            correctAnswer: answer,
            points: subjectCode === "math" ? 2 : 1,
          })),
        }),
      });

      const data = (await response.json()) as {
        quizId?: string;
      } & ApiError;

      if (!response.ok || !data.quizId) {
        setErrorMessage(formatSubmitError(data));
        return;
      }

      setMessage("퀴즈가 등록되었습니다.");
      setErrorMessage(null);

      try {
        form.reset();
        setSelectedFileName(null);
        setSubjectCode("korean");
        updateQuestionCount(2);
        router.refresh();
      } catch {
        setMessage(
          "퀴즈가 등록되었습니다. 목록이 바로 갱신되지 않으면 브라우저를 새로고침해 주세요.",
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "등록 요청 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-zinc-950">새 퀴즈 등록</h2>
      <p className="mt-1 text-sm text-zinc-600">
        문제 파일은 PDF, PNG, JPG, WEBP 형식으로 10MB 이하만 업로드할 수 있습니다.
        직접 링크나 Storage 경로를 입력해도 됩니다.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">과목</span>
            <select
              value={subjectCode}
              onChange={(event) => setSubjectCode(event.target.value as SubjectCode)}
              className={fieldClassName}
            >
              {subjectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700">문항 수</span>
            <input
              type="number"
              min={1}
              max={50}
              value={questionCount}
              onChange={(event) => updateQuestionCount(Number(event.target.value))}
              className={fieldClassName}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">제목</span>
          <input
            required
            name="title"
            className={fieldClassName}
            placeholder="예: 문학 작품의 표현 방식"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">설명</span>
          <textarea
            name="description"
            rows={3}
            className={fieldClassName}
            placeholder="학생에게 보여줄 퀴즈 설명"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">문제 파일 업로드</span>
          <input
            name="questionFile"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className={fileFieldClassName}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setSelectedFileName(file?.name ?? null);
            }}
          />
          <span className="mt-2 block text-sm text-zinc-600">
            {selectedFileName ? `선택한 파일: ${selectedFileName}` : "선택하지 않으면 파일 없이 등록됩니다."}
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">
            문제 파일 링크 또는 저장 경로
          </span>
          <input
            name="pdfStoragePath"
            className={fieldClassName}
            placeholder="예: https://... 또는 storage path"
          />
          <span className="mt-2 block text-sm text-zinc-600">
            파일을 업로드하면 업로드된 파일 경로가 우선 저장됩니다.
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            name="published"
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300"
          />
          공개 상태로 등록
        </label>

        <div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-base font-semibold text-zinc-950">문항별 정답</h3>
            <p className="text-sm text-zinc-600">{answerHelp}</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {answers.map((answer, index) => (
              <label key={index} className="block rounded-md bg-zinc-50 p-3">
                <span className="text-sm font-medium text-zinc-700">
                  {index + 1}번 정답
                </span>
                <input
                  required
                  value={answer}
                  onChange={(event) => updateAnswer(index, event.target.value)}
                  className={fieldClassName}
                  placeholder={subjectCode === "math" ? "예: 1/2" : "1~5"}
                />
              </label>
            ))}
          </div>
        </div>

        {message ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isSubmitting ? "등록 중..." : "퀴즈 등록"}
        </button>
      </form>
    </section>
  );
}

async function uploadSelectedQuestionFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  if (value.size > maxFileSize) {
    throw new Error("파일 업로드 오류: 문제 파일은 10MB 이하만 업로드할 수 있습니다.");
  }

  const formData = new FormData();
  formData.append("file", value);

  const response = await fetch("/api/admin/quiz-files", {
    method: "POST",
    body: formData,
  });
  const data = (await response.json()) as UploadedQuestionFile & ApiError;

  if (!response.ok || !data.path) {
    throw new Error(formatSubmitError(data, "파일 업로드 오류"));
  }

  return {
    path: data.path,
    mimeType: data.mimeType,
    originalName: data.originalName,
  };
}

function formatSubmitError(data: ApiError, fallbackStage = "등록 오류") {
  const stage = data.errorStage ?? fallbackStage;
  const message = data.errorMessage ?? "서버가 오류 원인을 반환하지 않았습니다.";
  const detail =
    data.error?.name || data.error?.message
      ? ` (${data.error.name ?? "Error"}: ${data.error.message ?? "Unknown error"})`
      : "";

  return `${stage}: ${message}${detail}`;
}
