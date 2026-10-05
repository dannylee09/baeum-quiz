"use client";

import { useId, useState } from "react";
import { QUESTION_FILE_ACCEPT } from "@/lib/uploads/validation";
import type { QuestionFileUpload as UploadState } from "@/lib/uploads/use-question-file-upload";

export default function QuestionFileUpload({ upload, disabled = false, existingName }: {
  upload: UploadState;
  disabled?: boolean;
  existingName?: string;
}) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const busy = disabled || upload.status === "uploading" || upload.status === "checking";
  const { selection } = upload;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-zinc-800">문제 파일</p>
        <p className="mt-1 text-sm text-zinc-600">PDF·PNG·JPG·WEBP, 최대 4MB(4,194,304바이트). 여러 페이지는 PDF 하나로 올려 주세요.</p>
      </div>
      <div
        onDragOver={(event) => { event.preventDefault(); if (!busy) setIsDragging(true); }}
        onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!busy) void upload.selectFiles(Array.from(event.dataTransfer.files));
        }}
        className={`rounded-lg border-2 border-dashed p-5 ${isDragging ? "border-indigo-500 bg-indigo-50" : "border-zinc-300 bg-zinc-50"}`}
      >
        <label htmlFor={inputId} className="block text-sm font-medium text-zinc-800">여기에 파일을 끌어 놓거나 아래에서 선택하세요.</label>
        <input
          id={inputId}
          type="file"
          accept={QUESTION_FILE_ACCEPT}
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (files.length) void upload.selectFiles(files);
          }}
          className="mt-3 block w-full text-sm text-zinc-800 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:font-semibold file:text-white disabled:opacity-50"
        />
        <p className="mt-3 text-xs leading-5 text-zinc-600">한글(HWP/HWPX)은 ‘파일 → PDF로 저장’, 워드는 ‘다른 이름으로 저장 → PDF’를 사용하세요. 용량이 크면 이미지 크기를 줄이거나 PDF를 압축해 주세요.</p>
      </div>

      {selection ? (
        <div className="rounded-lg border border-zinc-200 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 break-all text-sm font-medium text-zinc-800">{selection.file.name} <span className="font-normal text-zinc-500">({(selection.file.size / 1024 / 1024).toFixed(2)}MB)</span></p>
            <button type="button" disabled={busy} onClick={upload.reset} className="text-sm font-medium text-zinc-600 underline disabled:opacity-40">선택 취소</button>
          </div>
          {selection.mimeType.startsWith("image/") ? (
            // A local blob preview cannot be optimized by next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selection.previewUrl} alt="선택한 문제 파일 미리보기" className="mt-3 max-h-80 w-full rounded bg-zinc-100 object-contain" />
          ) : (
            <iframe title="선택한 PDF 미리보기" src={selection.previewUrl} className="mt-3 h-72 w-full rounded border border-zinc-200" />
          )}
          <a href={selection.previewUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-indigo-700 underline">선택한 파일 크게 보기</a>
        </div>
      ) : existingName ? (
        <p className="break-all text-sm text-zinc-600">현재 파일: {existingName}. 새 파일을 선택하면 저장할 때 교체됩니다.</p>
      ) : <p className="text-sm text-zinc-600">파일 없이도 등록할 수 있습니다. 파일은 퀴즈를 저장할 때 업로드됩니다.</p>}

      <div aria-live="polite" aria-atomic="true">
        {upload.status === "checking" ? <p className="text-sm text-zinc-600">파일 형식과 내용을 확인하고 있습니다…</p> : null}
        {upload.status === "ready" ? <p className="text-sm text-emerald-700">파일 확인 완료. 아래에서 정답을 입력하고 퀴즈를 저장해 주세요.</p> : null}
        {upload.status === "uploading" ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-indigo-700">{upload.progress === 100 ? "파일 전송 완료, 서버에서 저장을 확인하고 있습니다…" : `파일 업로드 중 ${upload.progress}%`}</p>
            <progress value={upload.progress} max={100} aria-label="파일 업로드 진행률" className="h-2 w-full accent-indigo-600" />
            <button type="button" onClick={upload.cancel} className="text-sm font-medium text-zinc-700 underline">업로드 취소</button>
          </div>
        ) : null}
        {upload.status === "uploaded" ? <p className="text-sm text-emerald-700">파일 업로드 완료. 퀴즈 저장까지 완료되어야 학생 화면에 반영됩니다.</p> : null}
        {upload.error ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>{upload.error}</p>
            {selection ? <button type="button" disabled={busy} onClick={() => { void upload.ensureUploaded().catch(() => {}); }} className="mt-2 font-semibold underline disabled:opacity-40">파일 업로드 다시 시도</button> : <button type="button" disabled={busy} onClick={upload.reset} className="mt-2 font-semibold underline disabled:opacity-40">파일 선택 취소</button>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
