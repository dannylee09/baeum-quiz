"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GradedSubmission } from "@/lib/types";

export type StoredResult = GradedSubmission & {
  submissionId: string;
  quizTitle: string;
  subjectName: string;
  maxScore: number;
  submittedAt: string;
  questionNumbers: Record<string, number>;
};

export default function ResultView() {
  const router = useRouter();
  const [result, setResult] = useState<StoredResult | null>(null);

  useEffect(() => {
    const rawResult = sessionStorage.getItem("baeum:last-result");
    if (!rawResult) {
      return;
    }

    let storedResult: StoredResult | null = null;

    try {
      storedResult = JSON.parse(rawResult) as StoredResult;
    } catch {
      storedResult = null;
    }

    // sessionStorage는 브라우저에서 마운트된 뒤에만 읽을 수 있습니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult(storedResult);
  }, []);

  useEffect(() => {
    if (!result) {
      return;
    }

    const timerId = window.setTimeout(() => {
      router.push("/");
    }, 7000);

    return () => window.clearTimeout(timerId);
  }, [result, router]);

  if (!result) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-950">
          결과 정보를 찾을 수 없습니다
        </h1>
        <p className="mt-3 text-zinc-600">
          결과 정보를 찾을 수 없습니다. 다시 제출해 주세요.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-md bg-zinc-950 px-5 py-3 font-semibold text-white"
        >
          퀴즈 목록으로 돌아가기
        </Link>
      </section>
    );
  }

  const correctCount = result.answers.filter((answer) => answer.isCorrect).length;

  return (
    <div className="space-y-6">
      <meta httpEquiv="refresh" content="7;url=/" />
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-zinc-600">{result.subjectName}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
          제출 결과
        </h1>
        <p className="mt-2 text-zinc-600">{result.quizTitle}</p>
        <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800">
          잠시 후 퀴즈 목록으로 이동합니다.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-600">학생</p>
            <p className="mt-1 font-semibold text-zinc-950">
              {result.studentNo} {result.studentName}
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-600">점수</p>
            <p className="mt-1 font-semibold text-zinc-950">
              {result.totalScore} / {result.maxScore}
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-600">정답 문항</p>
            <p className="mt-1 font-semibold text-zinc-950">
              {correctCount} / {result.answers.length}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">문항별 결과</h2>
        <div className="mt-4 divide-y divide-zinc-200">
          {result.answers.map((answer) => (
            <div
              key={answer.questionId}
              className="grid gap-3 py-4 sm:grid-cols-[80px_1fr_100px]"
            >
              <p className="font-semibold text-zinc-950">
                {result.questionNumbers[answer.questionId]}번
              </p>
              <div className="space-y-1 text-sm text-zinc-600">
                <p>
                  내가 낸 답:{" "}
                  <span className="font-medium text-zinc-950">
                    {answer.rawAnswer || "-"}
                  </span>
                </p>
                <p>
                  채점용으로 정리된 답:{" "}
                  <span className="font-medium text-zinc-950">
                    {answer.normalizedAnswer ?? "-"}
                  </span>
                </p>
                {answer.errorMessage && (
                  <p className="font-medium text-red-600">
                    {answer.errorMessage}
                  </p>
                )}
              </div>
              <p
                className={`text-sm font-semibold ${
                  answer.isCorrect ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {answer.isCorrect ? "정답" : "오답"} · {answer.score}점
              </p>
            </div>
          ))}
        </div>
      </section>

      <Link
        href="/"
        className="inline-flex rounded-md border border-zinc-300 bg-white px-5 py-3 font-semibold text-zinc-800 hover:border-zinc-900"
      >
        퀴즈 목록으로 돌아가기
      </Link>
    </div>
  );
}
