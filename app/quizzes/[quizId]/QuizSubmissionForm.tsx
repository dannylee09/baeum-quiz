"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import type { GradedSubmission, Question } from "@/lib/types";
import type { MockQuiz } from "@/lib/mock-data";

type StoredResult = GradedSubmission & {
  submissionId: string;
  quizTitle: string;
  subjectName: string;
  maxScore: number;
  submittedAt: string;
  questionNumbers: Record<string, number>;
};

type Props = {
  quiz: StudentQuiz;
};

export type StudentQuiz = Omit<MockQuiz, "questions"> & {
  questions: Array<Omit<Question, "correctAnswer">>;
};

const fieldClassName =
  "mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-950 outline-none placeholder:text-zinc-700 focus:border-zinc-900 disabled:text-zinc-950 disabled:opacity-100";

export default function QuizSubmissionForm({ quiz }: Props) {
  const router = useRouter();
  const [studentNo, setStudentNo] = useState("");
  const [studentName, setStudentName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [retryRequired, setRetryRequired] = useState(false);
  const [retryToken, setRetryToken] = useState<string | undefined>();
  const [confirmedResult, setConfirmedResult] = useState<StoredResult | null>(null);
  const requestId = useRef<string | null>(null);
  const submitLock = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxScore = useMemo(
    () => quiz.questions.reduce((total, question) => total + question.points, 0),
    [quiz.questions],
  );

  function clearError(questionId: string) {
    setErrors((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  }

  function validateAnswers(formData: FormData) {
    const nextErrors: Record<string, string> = {};

    for (const question of quiz.questions) {
      const answer = String(formData.get(question.id) ?? "").trim();

      if (!answer) {
        nextErrors[question.id] =
          question.answerType === "choice"
            ? "답안을 선택해 주세요."
            : "답안을 입력해 주세요.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    const formData = new FormData(event.currentTarget);
    setSubmitError(null);

    if (!validateAnswers(formData)) {
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);

    try {
      requestId.current ??= crypto.randomUUID();
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: requestId.current,
          quizSetId: quiz.id,
          studentNo: studentNo.trim(),
          studentName: studentName.trim(),
          isFinalAttempt: retryRequired,
          retryToken,
          answers: quiz.questions.map((question) => ({
            questionId: question.id,
            rawAnswer: String(formData.get(question.id) ?? ""),
          })),
        }),
      });

      const data = (await response.json()) as {
        result?: StoredResult;
        needsRetry?: boolean;
        retryToken?: string;
        message?: string;
        errorMessage?: string;
      };

      if (!response.ok) {
        setSubmitError(data.errorMessage ?? "제출 저장 중 오류가 발생했습니다.");
        return;
      }

      if (data.needsRetry) {
        if (!data.retryToken) {
          setSubmitError("재도전 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        setRetryToken(data.retryToken);
        setRetryRequired(true);
        setRetryMessage(
          data.message ??
            "아직 맞지 않은 문항이 있어요. 답안을 다시 확인한 뒤 한 번 더 제출해 보세요.",
        );
        return;
      }

      if (!data.result) {
        setSubmitError("제출 결과를 확인할 수 없습니다.");
        return;
      }

      setConfirmedResult(data.result);
      try {
        sessionStorage.setItem("baeum:last-result", JSON.stringify(data.result));
        router.push(`/result/${data.result.submissionId}`);
      } catch {
        // The database save has succeeded even if private browsing blocks storage.
      }
    } catch {
      setSubmitError("제출 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  if (confirmedResult) return (
    <section role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
      <h2 className="text-xl font-bold text-emerald-950">제출이 저장되었습니다.</h2>
      <p className="mt-3 text-emerald-900">점수: {confirmedResult.totalScore} / {confirmedResult.maxScore}점</p>
      <p className="mt-2 text-sm text-emerald-800">같은 퀴즈의 통계에는 마지막 제출이 반영됩니다.</p>
      <Link href="/" className="mt-5 inline-block font-semibold underline">퀴즈 목록으로 돌아가기</Link>
    </section>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 sm:space-y-6"
    >
      <input type="hidden" name="quizId" value={quiz.id} />
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-zinc-950">학생 정보</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">학번</span>
            <input
              required
              name="studentNo"
              inputMode="numeric"
              pattern="[1-3][0-9]{4}"
              maxLength={5}
              disabled={isSubmitting || retryRequired}
              value={studentNo}
              onChange={(event) => setStudentNo(event.target.value)}
              className={fieldClassName}
              placeholder="예: 20501"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">이름</span>
            <input
              required
              name="studentName"
              maxLength={40}
              disabled={isSubmitting || retryRequired}
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              className={fieldClassName}
              placeholder="예: 김학생"
            />
          </label>
        </div>
        <p className="mt-4 text-xs leading-5 text-zinc-600">학번·이름·답안·점수·제출 시각은 참여 확인과 통계·추첨을 위해 운영자에게 저장됩니다. 본인의 학번과 이름을 입력해 주세요.</p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">답안 입력</h2>
            <p className="mt-1 text-sm text-zinc-600">
              국어와 영어는 1~5번 중 하나를 선택하고, 수학은 정수 또는 분수만 입력합니다.
            </p>
          </div>
          <p className="text-sm font-medium text-zinc-700">총 {maxScore}점</p>
        </div>

        <div className="mt-5 space-y-5">
          {quiz.questions.map((question) => {
            const errorMessage = errors[question.id];

            return (
              <div
                key={question.id}
                className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-zinc-950">
                    {question.questionNo}번
                  </p>
                  <p className="text-sm text-zinc-600">{question.points}점</p>
                </div>

                {question.answerType === "choice" ? (
                  <div className="mt-4">
                    <div
                      role="radiogroup"
                      aria-label={`${question.questionNo}번 객관식 답안`}
                      className="grid grid-cols-5 gap-2"
                    >
                      {[1, 2, 3, 4, 5].map((choice) => {
                        const selectedChoice = String(choice);

                        return (
                          <label
                            key={selectedChoice}
                            className="group relative flex h-12 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white text-base font-semibold text-zinc-950 transition hover:border-zinc-700 hover:bg-zinc-100 has-[:checked]:border-zinc-950 has-[:checked]:bg-zinc-950 has-[:checked]:text-white has-[:checked]:shadow-sm has-[:checked]:ring-2 has-[:checked]:ring-zinc-300"
                          >
                            <input
                              type="radio"
                              disabled={isSubmitting}
                              name={question.id}
                              value={selectedChoice}
                              onChange={() => clearError(question.id)}
                              className="sr-only"
                            />
                            {choice}
                            <span className="sr-only">번 선택</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      선택한 번호는 진한 배경으로 표시됩니다.
                    </p>
                  </div>
                ) : (
                  <label className="mt-4 block">
                    <span className="text-sm text-zinc-600">
                      예: 3, -2, 1/2, 답: 2/4
                    </span>
                    <input
                      name={question.id}
                      maxLength={256}
                      disabled={isSubmitting}
                      onChange={() => clearError(question.id)}
                      className={fieldClassName}
                      placeholder="정수 또는 분수"
                    />
                  </label>
                )}

                {errorMessage && (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    {errorMessage}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {retryMessage ? (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-800"
        >
          <p>{retryMessage}</p>
          <p className="mt-1">입력한 학생 정보와 답안은 그대로 유지됩니다.</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-14 w-full rounded-md bg-zinc-950 px-5 py-4 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isSubmitting
          ? retryRequired
            ? "다시 제출 중..."
            : "제출 중..."
          : retryRequired
            ? "다시 제출하기"
            : "답안 제출하기"}
      </button>

      {submitError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {submitError}
        </p>
      ) : null}
    </form>
  );
}
