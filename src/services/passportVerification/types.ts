/** Passport verification pipeline — ICAO Doc 9303 TD3 (passport MRZ) */

export type VerificationStatus = 'verified' | 'partial' | 'failed' | 'manual_review';

export type VerificationTier = 'client_mrz' | 'client_gemini' | 'third_party';

export interface ImageQualityReport {
  score: number; // 0–100
  width: number;
  height: number;
  blurScore: number;
  brightness: number;
  issues: string[];
  acceptable: boolean;
}

export interface MrzFields {
  documentCode: string;
  issuingCountry: string;
  surname: string;
  givenNames: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string; // ISO YYYY-MM-DD
  sex: string;
  expiryDate: string; // ISO YYYY-MM-DD
  personalNumber?: string;
  rawLines: [string, string];
  checkDigitsValid: boolean;
  corrected: boolean;
}

export interface VizFields {
  surname?: string;
  givenNames?: string;
  passportNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  expiryDate?: string;
  issuingCountry?: string;
  source: 'gemini' | 'manual';
}

export interface CrossValidationReport {
  passed: boolean;
  mismatches: string[];
  matchedFields: string[];
}

export interface PassportVerificationResult {
  status: VerificationStatus;
  trustScore: number; // 0–100
  tier: VerificationTier;
  quality: ImageQualityReport;
  mrz: MrzFields | null;
  viz: VizFields | null;
  crossValidation: CrossValidationReport | null;
  warnings: string[];
  errors: string[];
  isExpired: boolean;
  verifiedAt: string;
}

export interface VerifyPassportOptions {
  /** Skip Gemini VIZ extraction (MRZ-only mode) */
  skipGemini?: boolean;
  /** Minimum trust score to mark as verified (default 70) */
  minTrustScore?: number;
  /** Force third-party provider via Supabase Edge Function */
  useThirdParty?: boolean;
  /** Stellar wallet — passed as reference-id to Persona/Veriff */
  walletAddress?: string;
}
