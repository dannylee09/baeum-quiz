"use client";

import { useEffect, useState } from "react";

type Props = {
  fileName: string | null;
  filePath: string | null;
  fileUrl: string | null;
  mimeType: string | null;
};

export default function ProblemFileViewer({
  fileName,
  filePath,
  fileUrl,
  mimeType,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const canOpenFile = Boolean(filePath && fileUrl);

  return (
    <>
      <div className="overflow-hidden border-y border-zinc-200 bg-zinc-100 sm:rounded-md sm:border">
        <div className="flex flex-col gap-3 border-b border-zinc-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p className="min-w-0 truncate text-sm font-semibold text-zinc-900">
            {fileName ?? "문제 파일"}
          </p>
          {canOpenFile ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="min-h-11 flex-1 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white sm:flex-none"
              >
                문제 크게 보기
              </button>
              <a
                href={fileUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 sm:flex-none"
              >
                새 탭에서 열기
              </a>
            </div>
          ) : null}
        </div>

        <ProblemFile
          fileName={fileName}
          filePath={filePath}
          fileUrl={fileUrl}
          mimeType={mimeType}
        />
      </div>

      {isOpen && filePath && fileUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="문제 파일 크게 보기"
          className="fixed inset-0 z-50 flex h-[100svh] flex-col bg-zinc-950"
        >
          <div className="flex min-h-16 items-center justify-between gap-3 border-b border-white/20 px-3 py-2 text-white sm:px-5">
            <p className="min-w-0 truncate text-sm font-semibold">
              {fileName ?? "문제 파일"}
            </p>
            <div className="flex shrink-0 gap-2">
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-md border border-white/40 px-3 py-2 text-sm font-semibold"
              >
                새 탭에서 열기
              </a>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-11 rounded-md bg-white px-4 py-2 text-sm font-bold text-zinc-950"
              >
                닫기
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
            <ProblemFile
              fileName={fileName}
              filePath={filePath}
              fileUrl={fileUrl}
              mimeType={mimeType}
              fullScreen
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function ProblemFile({
  fileName,
  filePath,
  fileUrl,
  mimeType,
  fullScreen = false,
}: Props & { fullScreen?: boolean }) {
  if (!filePath || !fileUrl) {
    return (
      <div className="flex min-h-[50svh] items-center justify-center p-6 text-center sm:min-h-80">
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
      <iframe
        src={fileUrl}
        title={fileName ?? "문제 파일 PDF"}
        className={
          fullScreen
            ? "h-full min-h-0 w-full bg-white"
            : "h-[75svh] min-h-[70svh] w-full bg-white sm:h-[80svh]"
        }
      />
    );
  }

  if (isImage(filePath, mimeType)) {
    return (
      <div
        className={
          fullScreen
            ? "h-full w-full overflow-x-hidden overflow-y-auto bg-zinc-950"
            : "min-h-[70svh] w-full overflow-visible bg-zinc-100"
        }
      >
        {/* Keep the original problem image legible without an image proxy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl}
          alt={fileName ?? "문제 파일 이미지"}
          className="block h-auto w-full max-w-none object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center p-6 text-center ${
        fullScreen ? "h-full bg-zinc-950 text-white" : "min-h-[70svh] bg-white"
      }`}
    >
      <div>
        <p className="text-base font-medium">{fileName ?? "문제 파일"}</p>
        <p className={`mt-2 text-sm leading-6 ${fullScreen ? "text-zinc-300" : "text-zinc-600"}`}>
          미리보기를 지원하지 않는 형식입니다. 새 탭에서 파일을 확인해 주세요.
        </p>
      </div>
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
