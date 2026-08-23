import { crossValidateVizAndMrz } from './crossValidate';
import { extractPassportVizWithGemini } from './geminiPassport';
import { analyzePassportImageQuality, fileToBase64 } from './imageQuality';
import { isLikelyCorruptedName, isPassportExpired } from './mrzParser';
import { ocrPassportMrz } from './mrzOcr';
import {
  isServerPassportFallbackEnabled,
  mergeServerVerification,
  verifyPassportViaServer,
} from './thirdPartyPassport';
import type { MrzFields, PassportVerificationResult, VerifyPassportOptions, VizFields } from './types';

export type {
  PassportVerificationResult,
  VerifyPassportOptions,
  MrzFields,
  VizFields,
  VerificationStatus,
} from './types';

export { crossValidateVizAndMrz } from './crossValidate';
export { mrzDateToIso, isPassportExpired, cleanMrzNameField } from './mrzParser';
export {
  isServerPassportFallbackEnabled,
  verifyPassportViaServer,
  type ServerPassportVerificationResponse,
} from './thirdPartyPassport';

function enrichMrzFromViz(mrz: MrzFields, viz: VizFields): { mrz: MrzFields; notes: string[] } {
  const notes: string[] = [];
  const updated = { ...mrz };

  if (viz.expiryDate && isPassportExpired(mrz.expiryDate) && !isPassportExpired(viz.expiryDate)) {
    updated.expiryDate = viz.expiryDate;
    notes.push('Expiry date taken from printed passport text');
  }

  if (viz.surname && isLikelyCorruptedName(mrz.surname)) {
    updated.surname = viz.surname.trim();
    notes.push('Surname refined from printed passport text');
  }

  if (viz.givenNames && isLikelyCorruptedName(mrz.givenNames)) {
    updated.givenNames = viz.givenNames.trim();
    notes.push('Given names refined from printed passport text');
  }

  if (viz.nationality && mrz.nationality.length === 3 && viz.nationality.length === 3) {
    if (isLikelyCorruptedName(mrz.nationality)) {
      updated.nationality = viz.nationality.toUpperCase();
    }
  }

  return { mrz: updated, notes };
}

/**
 * Hybrid passport verification — best practices from 10+ apps:
 * 1. Image quality gate (Atlys YOLO-style pre-check)
 * 2. MRZ OCR + ICAO check digits (VFS/iVisa baseline) — lazy-loaded Tesseract
 * 3. Gemini VIZ extraction + cross-validation (Atlys BoltOCR tier)
 * 4. Server fallback via Supabase Edge Function (Persona / Veriff / server MRZ)
 */
export async function verifyPassport(
  file: File,
  options: VerifyPassportOptions = {}
): Promise<PassportVerificationResult> {
  const {
    skipGemini = false,
    minTrustScore = 70,
    useThirdParty = false,
    walletAddress,
  } = options;
  const warnings: string[] = [];
  const errors: string[] = [];

  const quality = await analyzePassportImageQuality(file);
  if (!quality.acceptable) {
    warnings.push(...quality.issues);
  }

  const { mrz: ocrMrz, error: mrzError } = await ocrPassportMrz(file);
  let mrz = ocrMrz;
  if (mrzError) errors.push(mrzError);

  let viz = null;
  let crossValidation = null;
  let tier: PassportVerificationResult['tier'] = 'client_mrz';

  if (!skipGemini && import.meta.env.VITE_GEMINI_API_KEY) {
    viz = await extractPassportVizWithGemini(file);
    if (viz && mrz) {
      tier = 'client_gemini';
      const enriched = enrichMrzFromViz(mrz, viz);
      mrz = enriched.mrz;
      warnings.push(...enriched.notes);
    } else if (viz) {
      tier = 'client_gemini';
    }
  }

  if (viz && mrz) {
    crossValidation = crossValidateVizAndMrz(mrz, viz);
    if (!crossValidation.passed && crossValidation.mismatches.length > 0) {
      warnings.push(...crossValidation.mismatches.map((m) => `Cross-check: ${m}`));
    }
  }

  const isExpired = mrz ? isPassportExpired(mrz.expiryDate) : false;
  if (isExpired) errors.push('Passport appears expired');

  let trustScore = 0;
  if (quality.acceptable) trustScore += 25;
  else if (quality.score >= 45) trustScore += 15;

  if (mrz?.checkDigitsValid) trustScore += 40;
  else if (mrz) trustScore += 18;

  if (mrz?.corrected) warnings.push('MRZ required OCR error correction — consider retaking photo');

  if (crossValidation?.passed) trustScore += 25;
  else if (viz && mrz) trustScore += 10;

  if (!isExpired && mrz) trustScore += 10;

  trustScore = Math.min(100, trustScore);

  let status: PassportVerificationResult['status'] = 'failed';
  const mrzVerifiedThreshold = mrz?.checkDigitsValid && !isExpired ? 55 : minTrustScore;

  if (trustScore >= mrzVerifiedThreshold && mrz?.checkDigitsValid && !isExpired) {
    status =
      crossValidation && !crossValidation.passed && crossValidation.mismatches.length > 0
        ? 'manual_review'
        : 'verified';
  } else if (mrz && trustScore >= 45 && !isExpired) {
    status = 'partial';
  } else if (mrz && trustScore >= 40) {
    status = 'partial';
  }

  if (!mrz) status = 'failed';

  let result: PassportVerificationResult = {
    status,
    trustScore,
    tier,
    quality,
    mrz,
    viz,
    crossValidation,
    warnings,
    errors,
    isExpired,
    verifiedAt: new Date().toISOString(),
  };

  const needsServer =
    useThirdParty ||
    (isServerPassportFallbackEnabled() &&
      (status === 'failed' || trustScore < minTrustScore || !mrz?.checkDigitsValid));

  if (needsServer) {
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const server = await verifyPassportViaServer({
        imageBase64: base64,
        mimeType,
        walletAddress,
        mrzLines: mrz?.rawLines,
        provider: useThirdParty ? 'auto' : 'auto',
      });
      if (server?.ok) {
        result = mergeServerVerification(result, server);
      }
    } catch (err) {
      console.warn('Server passport fallback skipped:', err);
    }
  }

  return result;
}
