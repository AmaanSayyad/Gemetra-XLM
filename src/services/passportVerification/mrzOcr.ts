import { cropMrzRegion } from './imageQuality';
import { extractMrzLines, parsePassportMrz } from './mrzParser';
import type { MrzFields } from './types';

type TesseractModule = typeof import('tesseract.js');

let tesseractModule: TesseractModule | null = null;
let workerPromise: Promise<import('tesseract.js').Worker> | null = null;

async function loadTesseract(): Promise<TesseractModule> {
  if (!tesseractModule) {
    tesseractModule = await import('tesseract.js');
  }
  return tesseractModule;
}

async function getMrzWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await loadTesseract();
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: () => {},
      });
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      });
      return worker;
    })();
  }
  return workerPromise;
}

/** OCR the MRZ band — lazy-loaded Tesseract (~2MB WASM, not in initial bundle) */
export async function ocrPassportMrz(file: File): Promise<{
  mrz: MrzFields | null;
  rawText: string;
  error?: string;
}> {
  try {
    const mrzDataUrl = await cropMrzRegion(file);
    const worker = await getMrzWorker();
    const { data } = await worker.recognize(mrzDataUrl);
    const rawText = data.text ?? '';

    const lines = extractMrzLines(rawText);
    if (!lines) {
      return { mrz: null, rawText, error: 'Could not locate MRZ lines — ensure the full bio page is visible' };
    }

    const mrz = parsePassportMrz(lines);
    if (!mrz) {
      return { mrz: null, rawText, error: 'MRZ parse failed — retake with better lighting' };
    }

    return { mrz, rawText };
  } catch (err) {
    return {
      mrz: null,
      rawText: '',
      error: err instanceof Error ? err.message : 'MRZ OCR failed',
    };
  }
}

export async function terminateMrzWorker(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
