import { NextResponse } from "next/server";

export function validateMutationRequest(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  // Next may reconstruct request.url using an internal localhost hostname.
  // Use the actual HTTP Host, never client-supplied X-Forwarded-Host.
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const protocol = process.env.VERCEL === "1" ? "https:" : requestUrl.protocol;
  let expectedOrigin: string | null = null;
  try {
    if (!/[\s,/@\\]/.test(host)) expectedOrigin = new URL(`${protocol}//${host}`).origin;
  } catch {}

  // Cookie authentication needs a browser origin check even for multipart forms.
  if (
    !expectedOrigin || origin !== expectedOrigin ||
    (fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none")
  ) {
    return NextResponse.json(
      { errorMessage: "사이트에서 다시 시도해 주세요." },
      { status: 403 },
    );
  }
  return null;
}

type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse };

export async function readJsonBody(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<JsonBodyResult> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return failure(415, "JSON 형식으로 요청해 주세요.");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    return failure(413, "요청 데이터가 너무 큽니다.");
  }
  if (!request.body) return failure(400, "요청 데이터를 읽을 수 없습니다.");

  const reader = request.body.getReader();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const read = async () => {
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          void reader.cancel().catch(() => undefined);
          return failure(413, "요청 데이터가 너무 큽니다.");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      return { ok: true as const, value };
    };
    return await Promise.race([
      read(),
      new Promise<JsonBodyResult>((resolve) => {
        timeout = setTimeout(() => {
          resolve(failure(408, "요청 시간이 초과되었습니다. 다시 시도해 주세요."));
          void reader.cancel().catch(() => undefined);
        }, 10_000);
      }),
    ]);
  } catch {
    return failure(400, "요청 데이터를 읽을 수 없습니다.");
  } finally {
    if (timeout) clearTimeout(timeout);
    reader.releaseLock();
  }
}

function failure(status: number, errorMessage: string): JsonBodyResult {
  return { ok: false, response: NextResponse.json({ errorMessage }, { status }) };
}
