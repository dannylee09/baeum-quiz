"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  quizId: string;
  published: boolean;
  submissionCount: number;
};

type ApiError = {
  errorStage?: string;
  errorMessage?: string;
  error?: {
    name?: string;
    message?: string;
  } | null;
};

export default function AdminQuizRowActions({
  quizId,
  published,
  submissionCount,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function togglePublished() {
    setMessage(null);
    setIsBusy(true);

    try {
      const response = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ published: !published }),
      });
      const data = (await response.json()) as ({ ok?: boolean } & ApiError);

      if (!response.ok || !data.ok) {
        setMessage(formatError(data, "공개 상태 변경 오류"));
        return;
      }

      setMessage(!published ? "공개로 전환했습니다." : "비공개로 전환했습니다.");

      try {
        router.refresh();
      } catch {
        setMessage(
          !published
            ? "공개로 전환했지만 화면을 갱신하지 못했습니다. 브라우저를 새로고침해 주세요."
            : "비공개로 전환했지만 화면을 갱신하지 못했습니다. 브라우저를 새로고침해 주세요.",
        );
      }
    } catch {
      setMessage("공개 상태 변경 오류: 서버 응답을 처리하지 못했습니다.");
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteQuiz() {
    if (submissionCount > 0) {
      setMessage("이미 제출 기록이 있어 삭제할 수 없습니다. 대신 비공개로 전환하세요.");
      return;
    }

    const confirmed = window.confirm(
      "정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    setIsBusy(true);

    try {
      const response = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as ({ ok?: boolean } & ApiError);

      if (!response.ok || !data.ok) {
        setMessage(formatError(data, "퀴즈 삭제 오류"));
        return;
      }

      setMessage("퀴즈를 삭제했습니다.");

      try {
        router.refresh();
      } catch {
        setMessage(
          "퀴즈는 삭제되었지만 화면을 갱신하지 못했습니다. 브라우저를 새로고침해 주세요.",
        );
      }
    } catch {
      setMessage("퀴즈 삭제 오류: 서버 응답을 처리하지 못했습니다.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/quizzes/${quizId}/edit`}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:border-zinc-900"
        >
          수정
        </Link>
        <button
          type="button"
          onClick={togglePublished}
          disabled={isBusy}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {published ? "비공개 전환" : "공개 전환"}
        </button>
        <button
          type="button"
          onClick={deleteQuiz}
          disabled={isBusy}
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          삭제
        </button>
      </div>
      {message ? <p className="text-xs font-medium text-zinc-700">{message}</p> : null}
    </div>
  );
}

function formatError(data: ApiError, fallbackStage: string) {
  const stage = data.errorStage ?? fallbackStage;
  const message = data.errorMessage ?? "서버가 오류 원인을 반환하지 않았습니다.";
  const detail =
    data.error?.name || data.error?.message
      ? ` (${data.error.name ?? "Error"}: ${data.error.message ?? "Unknown error"})`
      : "";

  return `${stage}: ${message}${detail}`;
}
