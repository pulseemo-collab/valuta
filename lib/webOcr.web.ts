// Web-only OCR using Tesseract.js.
// Loaded automatically by Metro on web; the native stub (webOcr.ts) loads elsewhere.

import Tesseract from 'tesseract.js';

export type OcrProgressEvent = { status: string; progress: number };

// Detect image MIME type from base64 magic bytes.
function detectMime(b64: string): string {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBOR')) return 'image/png';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

// Resize image to ≤ maxSide and boost contrast via Canvas.
// Returns a PNG data URL for best Tesseract accuracy.
function preprocessImage(base64: string): Promise<string> {
  const mime = detectMime(base64);
  const src = `data:${mime};base64,${base64}`;
  const MAX = 2000;
  const CONTRAST = 1.6;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;

      if (w > MAX || h > MAX) {
        const scale = MAX / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(src); return; }

      ctx.drawImage(img, 0, 0, w, h);

      const id = ctx.getImageData(0, 0, w, h);
      const px = id.data;
      for (let i = 0; i < px.length; i += 4) {
        const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const c = ((gray - 128) * CONTRAST) + 128;
        const v = Math.max(0, Math.min(255, Math.round(c)));
        px[i] = px[i + 1] = px[i + 2] = v;
        // alpha (px[i+3]) unchanged
      }
      ctx.putImageData(id, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

export async function runWebOcr(
  base64: string,
  onProgress?: (e: OcrProgressEvent) => void
): Promise<{ text: string; confidence: number }> {
  onProgress?.({ status: 'Përgatitja e imazhit...', progress: 5 });

  let imageData: string;
  try {
    imageData = await preprocessImage(base64);
    onProgress?.({ status: 'Imazhi u përgatit', progress: 12 });
  } catch {
    imageData = `data:image/jpeg;base64,${base64}`;
    onProgress?.({ status: 'Imazhi u ngarkua', progress: 12 });
  }

  try {
    // Use SINGLE_COLUMN PSM — receipts are narrow, single-column layouts
    const { data } = await Tesseract.recognize(imageData, 'eng', {
      logger: (m: Tesseract.LoggerMessage) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(12 + (m.progress ?? 0) * 80);
          onProgress?.({ status: 'Duke lexuar tekstin...', progress: pct });
        } else if (m.status === 'loading tesseract core') {
          onProgress?.({ status: 'Duke ngarkuar motorin OCR...', progress: 8 });
        } else if (m.status === 'initializing tesseract') {
          onProgress?.({ status: 'Duke inicializuar OCR...', progress: 10 });
        } else if (m.status === 'loading language traineddata') {
          onProgress?.({ status: 'Duke ngarkuar gjuhën...', progress: 11 });
        }
      },
    } as Partial<Tesseract.WorkerOptions>);

    onProgress?.({ status: 'Gati', progress: 100 });

    if (__DEV__) {
      console.log('[webOcr] Raw OCR text:\n', data.text);
      console.log('[webOcr] Confidence:', data.confidence);
    }

    return { text: data.text ?? '', confidence: data.confidence ?? 0 };
  } catch (err) {
    if (__DEV__) console.warn('[webOcr] Tesseract failed:', err);
    onProgress?.({ status: 'Gabim gjatë leximit', progress: 100 });
    return { text: '', confidence: 0 };
  }
}
