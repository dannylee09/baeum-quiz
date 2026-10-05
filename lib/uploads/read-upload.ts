import { MAX_UPLOAD_REQUEST_BYTES } from "./validation";

export class UploadRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function readUploadFormData(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new UploadRequestError("파일 업로드 형식이 올바르지 않습니다.", 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_UPLOAD_REQUEST_BYTES) {
    throw new UploadRequestError("업로드 용량을 초과했습니다. 4MB 이하 파일 하나를 선택해 주세요.", 413);
  }
  if (!request.body) throw new UploadRequestError("업로드할 문제 파일을 선택해 주세요.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UPLOAD_REQUEST_BYTES) {
        await reader.cancel();
        throw new UploadRequestError("업로드 용량을 초과했습니다. 4MB 이하 파일 하나를 선택해 주세요.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return await new Response(body, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new UploadRequestError("업로드 데이터를 읽을 수 없습니다. 파일을 다시 선택해 주세요.", 400);
  }
}
