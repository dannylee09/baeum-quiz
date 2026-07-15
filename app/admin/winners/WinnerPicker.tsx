"use client";

import { useMemo, useState } from "react";
import { maskStudentName, maskStudentNo } from "@/lib/mock-data";
import type { SubjectCode } from "@/lib/types";
import type { AdminSubmission } from "@/lib/supabase/admin-queries";

type Props = {
  submissions: AdminSubmission[];
};

const subjectLabels: Record<SubjectCode, string> = {
  korean: "국어",
  english: "영어",
  math: "수학",
};

export default function WinnerPicker({ submissions }: Props) {
  const [subjectCode, setSubjectCode] = useState<SubjectCode>("korean");
  const [winnerId, setWinnerId] = useState<string | null>(null);

  const candidates = useMemo(
    () =>
      submissions.filter(
        (submission) =>
          submission.subjectCode === subjectCode &&
          submission.finalScore === submission.maxScore,
      ),
    [subjectCode, submissions],
  );
  const winner = candidates.find((candidate) => candidate.id === winnerId) ?? null;

  function pickWinner() {
    if (candidates.length === 0) {
      setWinnerId(null);
      return;
    }

    const index = Math.floor(Math.random() * candidates.length);
    setWinnerId(candidates[index].id);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-zinc-950">과목별 정답자 추첨</h2>
      <p className="mt-1 text-sm text-zinc-600">
        공개 화면에 사용할 수 있도록 학번과 이름을 마스킹한 값도 함께 보여줍니다.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {Object.entries(subjectLabels).map(([code, label]) => (
          <button
            key={code}
            type="button"
            onClick={() => {
              setSubjectCode(code as SubjectCode);
              setWinnerId(null);
            }}
            className={`rounded-md border px-4 py-2 text-sm font-semibold ${
              subjectCode === code
                ? "border-zinc-950 bg-zinc-950 text-white"
                : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-600">추첨 대상</p>
        <p className="mt-1 text-2xl font-bold text-zinc-950">
          {candidates.length}명
        </p>
        <button
          type="button"
          onClick={pickWinner}
          className="mt-4 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white"
        >
          정답자 추첨
        </button>
      </div>

      {winner && (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-700">추첨 결과</p>
          <p className="mt-2 text-lg font-bold text-zinc-950">
            {maskStudentNo(winner.studentNo)} {maskStudentName(winner.studentName)}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            공개 표시: {maskStudentNo(winner.studentNo)}{" "}
            {maskStudentName(winner.studentName)}
          </p>
        </div>
      )}
    </section>
  );
}
