// Leave space for multipart headers below Vercel's 4.5 MB request limit.
export const MAX_QUESTION_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_REQUEST_BYTES = MAX_QUESTION_FILE_BYTES + 64 * 1024;
export const QUESTION_FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

export type UploadedQuestionFile = { path: string; mimeType: string; originalName: string };
type FileMetadata = { name: string; size: number; type: string };
type FileFormat = { mimeType: string; extension: string };
const formats: Record<string, FileFormat> = {
  pdf: { mimeType: "application/pdf", extension: "pdf" },
  png: { mimeType: "image/png", extension: "png" },
  jpg: { mimeType: "image/jpeg", extension: "jpg" },
  jpeg: { mimeType: "image/jpeg", extension: "jpg" },
  webp: { mimeType: "image/webp", extension: "webp" },
};

export function validateQuestionFileMetadata(file: FileMetadata): string | null {
  if (!file.size) return "빈 파일은 업로드할 수 없습니다. 문제 파일을 다시 저장해 주세요.";
  if (file.size > MAX_QUESTION_FILE_BYTES) {
    return "문제 파일은 4MB(4,194,304바이트) 이하만 업로드할 수 있습니다. PDF 용량을 줄이거나 이미지 크기를 줄여 주세요.";
  }
  const format = formats[file.name.split(".").at(-1)?.toLowerCase() ?? ""];
  if (!format) return "PDF, PNG, JPG, WEBP 파일만 가능합니다. 한글·워드 문서는 PDF로 저장한 뒤 선택해 주세요.";
  if (file.type && file.type !== "application/octet-stream" && file.type !== format.mimeType) {
    return "파일 이름과 형식이 일치하지 않습니다. 원본 프로그램에서 다시 저장해 주세요.";
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

// Reject renamed files and obviously truncated containers; this does not claim
// to perform malware scanning or fully decode the document/image.
export function detectQuestionFileFormat(bytes: Uint8Array): FileFormat | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (/^%PDF-(?:1\.[0-7]|2\.0)[\r\n\s]/.test(ascii(bytes, 0, 9))) {
    return /%%EOF[\x00\t\n\f\r ]*$/.test(ascii(bytes, Math.max(0, bytes.length - 1024), bytes.length)) ? formats.pdf : null;
  }
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) {
    if (bytes.length < 45 || view.getUint32(8) !== 13 || ascii(bytes, 12, 16) !== "IHDR") return null;
    if (!view.getUint32(16) || !view.getUint32(20)) return null;
    let offset = 8;
    let hasImageData = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      const type = ascii(bytes, offset + 4, offset + 8);
      if (length > bytes.length - offset - 12) return null;
      if (type === "IDAT" && length > 0) hasImageData = true;
      offset += length + 12;
      if (type === "IEND") return length === 0 && hasImageData && offset === bytes.length ? formats.png : null;
    }
    return null;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    if (bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return null;
    let offset = 2;
    let hasFrame = false;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xda) return hasFrame ? formats.jpg : null;
      if (marker === 0xd9 || marker === 0x00 || offset + 2 > bytes.length) return null;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8 || !view.getUint16(offset + 3) || !view.getUint16(offset + 5)) return null;
        hasFrame = true;
      }
      offset += length;
    }
    return null;
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    if (bytes.length < 30 || view.getUint32(4, true) + 8 !== bytes.length) return null;
    let offset = 12;
    let hasImage = false;
    while (offset + 8 <= bytes.length) {
      const type = ascii(bytes, offset, offset + 4);
      const length = view.getUint32(offset + 4, true);
      if (length > bytes.length - offset - 8) return null;
      if (type === "VP8 " && length >= 10 && ascii(bytes, offset + 11, offset + 14) === "\x9d\x01\x2a") hasImage = true;
      if (type === "VP8L" && length >= 5 && bytes[offset + 8] === 0x2f) hasImage = true;
      if (type === "ANMF" && length >= 24) hasImage = true;
      offset += 8 + length + (length % 2);
    }
    return hasImage && offset === bytes.length ? formats.webp : null;
  }
  return null;
}

export function validateQuestionFileContent(file: FileMetadata, bytes: Uint8Array) {
  const metadataError = validateQuestionFileMetadata(file);
  if (metadataError) return { ok: false as const, error: metadataError };
  const format = detectQuestionFileFormat(bytes);
  const expected = formats[file.name.split(".").at(-1)?.toLowerCase() ?? ""];
  if (bytes.length !== file.size || !format || format.mimeType !== expected.mimeType) {
    return { ok: false as const, error: "실제 파일 내용이 올바른 PDF 또는 이미지가 아닙니다. 손상되지 않은 원본 파일을 선택해 주세요." };
  }
  return { ok: true as const, ...format };
}

export function safeOriginalFileName(name: string) {
  return name.normalize("NFKC").split(/[\\/]/).at(-1)?.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180) || "문제 파일";
}
