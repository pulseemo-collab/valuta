// Native stub — Tesseract.js does not run on native platforms.
// Metro resolves webOcr.web.ts on web automatically.

export type OcrProgressEvent = { status: string; progress: number };

export async function runWebOcr(
  _base64: string,
  _onProgress?: (e: OcrProgressEvent) => void
): Promise<{ text: string; confidence: number }> {
  return { text: '', confidence: 0 };
}
