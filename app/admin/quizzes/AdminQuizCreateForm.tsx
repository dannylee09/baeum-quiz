"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SubjectCode } from "@/lib/types";
import { useQuestionFileUpload } from "@/lib/uploads/use-question-file-upload";
import QuestionFileUpload from "./QuestionFileUpload";

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

export default function AdminQuizCreateForm() {
  const router = useRouter();
  const [subjectCode, setSubjectCode] = useState<SubjectCode>("korean");
  const [questionCount, setQuestionCount] = useState(2);
  const [answers, setAnswers] = useState<string[]>(["", ""]);
  const upload = useQuestionFileUpload();
  const submittingRef = useRef(false);
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
    const count = Number.isFinite(nextCount) ? Math.min(Math.max(Math.trunc(nextCount), 1), 50) : 1;
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
    if (submittingRef.current) return;
    submittingRef.current = true;
    const form = event.currentTarget;
    setMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(form);

    try {
      const uploadedFile = await upload.ensureUploaded();

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
      form.reset();
      upload.reset();
      setSubjectCode("korean");
      setQuestionCount(2);
      setAnswers(["", ""]);

      try {
        router.refresh();
      } catch {
        setMessage(
          "퀴즈는 등록되었지만 화면을 갱신하지 못했습니다. 브라우저를 새로고침해 주세요.",
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "등록 요청 오류가 발생했습니다.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-zinc-950">새 퀴즈 등록</h2>
      <p className="mt-1 text-sm text-zinc-600">
        과목과 제목, 문제 파일, 문항별 정답을 입력해 주세요. 공개 여부는 나중에 바꿀 수 있습니다.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">과목</span>
            <select
              value={subjectCode}
              onChange={(event) => setSubjectCode(event.target.value as SubjectCode)}
              className={fieldClassName}
              disabled={isSubmitting}
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
              step={1}
              disabled={isSubmitting}
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
            maxLength={200}
            disabled={isSubmitting}
            className={fieldClassName}
            placeholder="예: 문학 작품의 표현 방식"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">설명</span>
          <textarea
            name="description"
            maxLength={4000}
            disabled={isSubmitting}
            rows={3}
            className={fieldClassName}
            placeholder="학생에게 보여줄 퀴즈 설명"
          />
        </label>

        <QuestionFileUpload upload={upload} disabled={isSubmitting} />

        <details className="rounded-md border border-zinc-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700">기존 문제 파일 링크 사용하기</summary>
          <label className="mt-3 block">
            <span className="text-sm text-zinc-700">문제 파일 링크 또는 저장 경로</span>
            <input name="pdfStoragePath" maxLength={2000} disabled={isSubmitting} className={fieldClassName} placeholder="https://... 또는 기존 저장 경로" />
            <span className="mt-2 block text-xs text-zinc-600">새 파일을 선택하면 업로드한 파일이 우선 저장됩니다.</span>
          </label>
        </details>

        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            name="published"
            disabled={isSubmitting}
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
                  maxLength={100}
                  disabled={isSubmitting}
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
          <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </p>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || upload.status === "checking" || upload.status === "uploading"}
          className="rounded-md bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isSubmitting ? (upload.status === "uploading" ? "문제 파일 업로드 중…" : "퀴즈 저장 중…") : "퀴즈 등록"}
        </button>
      </form>
    </section>
  );
}

function formatSubmitError(data: ApiError, fallbackStage = "등록 오류") {
  const stage = data.errorStage ?? fallbackStage;
  const message = data.errorMessage ?? "서버가 오류 원인을 반환하지 않았습니다.";
  return `${stage}: ${message}`;
}
