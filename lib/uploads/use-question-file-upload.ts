"use client";

import { useEffect, useRef, useState } from "react";
import { validateQuestionFileContent, validateQuestionFileMetadata, type UploadedQuestionFile } from "./validation";

type UploadStatus = "empty" | "checking" | "ready" | "uploading" | "uploaded" | "error";
type Selection = { file: File; previewUrl: string; mimeType: string };

export function useQuestionFileUpload() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [status, setStatus] = useState<UploadStatus>("empty");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const selectedRef = useRef<Selection | null>(null);
  const uploadedRef = useRef<UploadedQuestionFile | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const selectionVersion = useRef(0);
  const promiseRef = useRef<Promise<UploadedQuestionFile> | null>(null);

  useEffect(() => () => {
    selectionVersion.current += 1;
    xhrRef.current?.abort();
    if (selectedRef.current) URL.revokeObjectURL(selectedRef.current.previewUrl);
  }, []);

  function reset() {
    selectionVersion.current += 1;
    xhrRef.current?.abort();
    if (selectedRef.current) URL.revokeObjectURL(selectedRef.current.previewUrl);
    selectedRef.current = null;
    uploadedRef.current = null;
    setSelection(null);
    setStatus("empty");
    setProgress(0);
    setError(null);
  }

  async function selectFiles(files: File[]) {
    if (xhrRef.current) return;
    reset();
    if (!files.length) return;
    if (files.length !== 1) {
      setError("문제 파일은 한 번에 하나만 선택해 주세요. 여러 페이지는 PDF 하나로 저장해 주세요.");
      setStatus("error");
      return;
    }
    const file = files[0];
    const metadataError = validateQuestionFileMetadata(file);
    if (metadataError) { setError(metadataError); setStatus("error"); return; }
    const version = selectionVersion.current;
    setStatus("checking");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (version !== selectionVersion.current) return;
      const validated = validateQuestionFileContent(file, bytes);
      if (!validated.ok) { setError(validated.error); setStatus("error"); return; }
      const next = { file, mimeType: validated.mimeType, previewUrl: URL.createObjectURL(new Blob([bytes], { type: validated.mimeType })) };
      selectedRef.current = next;
      setSelection(next);
      setStatus("ready");
    } catch {
      if (version !== selectionVersion.current) return;
      setError("선택한 파일을 읽지 못했습니다. 다시 선택해 주세요.");
      setStatus("error");
    }
  }

  async function ensureUploaded(): Promise<UploadedQuestionFile | null> {
    if (promiseRef.current) return promiseRef.current;
    if (status === "checking") throw new Error("파일 확인이 끝날 때까지 기다려 주세요.");
    if (!selectedRef.current) {
      if (error) throw new Error(error);
      return null;
    }
    if (uploadedRef.current) return uploadedRef.current;
    const file = selectedRef.current.file;
    setStatus("uploading");
    setProgress(0);
    setError(null);
    const upload = new Promise<UploadedQuestionFile>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("POST", "/api/admin/quiz-files");
      xhr.timeout = 120_000;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.min(100, Math.round(event.loaded * 100 / event.total)));
      };
      xhr.onerror = () => reject(new Error("인터넷 연결을 확인한 뒤 파일 업로드를 다시 시도해 주세요."));
      xhr.ontimeout = () => reject(new Error("파일 업로드 시간이 초과되었습니다. 다시 시도해 주세요."));
      xhr.onabort = () => reject(new Error("파일 업로드를 취소했습니다. 다시 시도하거나 다른 파일을 선택해 주세요."));
      xhr.onload = () => {
        let data: Partial<UploadedQuestionFile> & { errorMessage?: string } = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* A proxy can return a non-JSON error page. */ }
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(data.errorMessage ?? (xhr.status === 413 ? "파일 용량이 너무 큽니다. 4MB 이하 파일을 선택해 주세요." : "파일 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.")));
        } else if (typeof data.path !== "string" || typeof data.mimeType !== "string" || typeof data.originalName !== "string") {
          reject(new Error("업로드 결과를 확인하지 못했습니다. 다시 시도해 주세요."));
        } else {
          resolve({ path: data.path, mimeType: data.mimeType, originalName: data.originalName });
        }
      };
      const body = new FormData();
      body.append("file", file);
      xhr.send(body);
    });
    promiseRef.current = upload;
    try {
      const result = await upload;
      uploadedRef.current = result;
      setStatus("uploaded");
      setProgress(100);
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "파일 업로드에 실패했습니다.";
      setError(message);
      setStatus("error");
      throw caught;
    } finally {
      xhrRef.current = null;
      promiseRef.current = null;
    }
  }

  return { selection, status, progress, error, selectFiles, reset, ensureUploaded, cancel: () => xhrRef.current?.abort() };
}

export type QuestionFileUpload = ReturnType<typeof useQuestionFileUpload>;
