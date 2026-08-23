import type { ImageQualityReport } from './types';

const MIN_WIDTH = 640;
const MIN_HEIGHT = 400;
const MIN_BLUR_VARIANCE = 80;
const MIN_BRIGHTNESS = 40;
const MAX_BRIGHTNESS = 220;

/** Laplacian variance — lower = blurrier */
function laplacianVariance(imageData: ImageData): number {
  const { data, width, height } = imageData;
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const center = data[idx];
      const top = data[((y - 1) * width + x) * 4];
      const bottom = data[((y + 1) * width + x) * 4];
      const left = data[(y * width + (x - 1)) * 4];
      const right = data[(y * width + (x + 1)) * 4];
      const lap = 4 * center - top - bottom - left - right;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

function averageBrightness(imageData: ImageData): number {
  const { data } = imageData;
  let total = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return total / pixels;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load passport image'));
    };
    img.src = url;
  });
}

/** Client-side quality gate — mirrors Atlys/Jumio pre-checks (blur, glare proxy, resolution) */
export async function analyzePassportImageQuality(file: File): Promise<ImageQualityReport> {
  const img = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const blurScore = laplacianVariance(imageData);
  const brightness = averageBrightness(imageData);
  const issues: string[] = [];

  if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) {
    issues.push('Image resolution too low — use a clearer photo of the bio page');
  }
  if (blurScore < MIN_BLUR_VARIANCE) {
    issues.push('Image appears blurry — hold steady and refocus');
  }
  if (brightness < MIN_BRIGHTNESS) {
    issues.push('Image too dark — improve lighting');
  }
  if (brightness > MAX_BRIGHTNESS) {
    issues.push('Image overexposed — reduce glare or flash (MRZ will still be processed)');
  }

  let score = 100;
  if (blurScore < MIN_BLUR_VARIANCE) score -= 35;
  else if (blurScore < 120) score -= 15;
  if (brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS) score -= 25;
  if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) score -= 20;

  return {
    score: Math.max(0, Math.min(100, score)),
    width: img.width,
    height: img.height,
    blurScore: Math.round(blurScore),
    brightness: Math.round(brightness),
    issues,
    acceptable: issues.length === 0,
  };
}

/** Crop bottom MRZ band (~22% of bio page height) for OCR */
export async function cropMrzRegion(file: File): Promise<string> {
  const img = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const mrzHeight = Math.round(img.height * 0.22);
  canvas.width = img.width;
  canvas.height = mrzHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(img, 0, img.height - mrzHeight, img.width, mrzHeight, 0, 0, img.width, mrzHeight);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  let totalBrightness = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const avgBrightness = totalBrightness / pixels;
  const overexposed = avgBrightness > MAX_BRIGHTNESS;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (overexposed) {
      // Binarize glare-heavy MRZ bands so Tesseract reads OCR-B reliably
      const v = gray > 175 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = v;
    } else {
      const boosted = Math.min(255, Math.max(0, (gray - 128) * 1.4 + 128));
      data[i] = data[i + 1] = data[i + 2] = boosted;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/png');
}

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [, base64] = result.split(',');
      resolve({ base64, mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
