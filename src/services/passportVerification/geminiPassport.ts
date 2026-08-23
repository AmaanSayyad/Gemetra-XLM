import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileToBase64 } from './imageQuality';
import type { VizFields } from './types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const PASSPORT_VIZ_PROMPT = `You are a passport data extraction engine for VAT tourist refund compliance.
Analyze this passport bio page image and extract ONLY the Visual Inspection Zone (printed text above the MRZ).

Return strict JSON with no markdown:
{
  "surname": "family name as printed",
  "givenNames": "given names as printed",
  "passportNumber": "document number",
  "nationality": "3-letter ISO country code if visible, else country name",
  "dateOfBirth": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD",
  "issuingCountry": "3-letter ISO code of issuing state"
}

Rules:
- Use null for fields you cannot read confidently
- Do not invent data
- Dates must be ISO format
- Passport number must match printed number exactly (include trailing < as letter if shown)`;

/** Gemini Vision VIZ extraction — Atlys BoltOCR-style tier when API key present */
export async function extractPassportVizWithGemini(file: File): Promise<VizFields | null> {
  if (!GEMINI_API_KEY) return null;

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const { base64, mimeType } = await fileToBase64(file);
    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      { text: PASSPORT_VIZ_PROMPT },
    ]);

    const text = result.response.text();
    const parsed = JSON.parse(text) as Record<string, string | null>;

    return {
      surname: parsed.surname ?? undefined,
      givenNames: parsed.givenNames ?? undefined,
      passportNumber: parsed.passportNumber ?? undefined,
      nationality: parsed.nationality ?? undefined,
      dateOfBirth: parsed.dateOfBirth ?? undefined,
      expiryDate: parsed.expiryDate ?? undefined,
      issuingCountry: parsed.issuingCountry ?? undefined,
      source: 'gemini',
    };
  } catch (err) {
    console.warn('Gemini passport VIZ extraction failed:', err);
    return null;
  }
}
