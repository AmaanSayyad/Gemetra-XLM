import type { MrzFields, PassportVerificationResult, VerificationStatus } from './types';

/** Response from Supabase Edge Function `verify-passport` */
export interface ServerPassportVerificationResponse {
  ok: boolean;
  provider: 'persona' | 'veriff' | 'server_mrz' | 'none';
  status: VerificationStatus | 'pending';
  trustScore: number;
  sessionId?: string;
  sessionUrl?: string;
  mrz?: {
    passportNumber: string;
    nationality: string;
    dateOfBirth: string;
    expiryDate: string;
    surname: string;
    givenNames: string;
    checkDigitsValid: boolean;
  };
  message?: string;
  error?: string;
}

export interface ServerVerifyRequest {
  imageBase64: string;
  mimeType: string;
  walletAddress?: string;
  mrzLines?: [string, string];
  provider?: 'auto' | 'persona' | 'veriff';
}

const SERVER_FALLBACK_ENABLED =
  import.meta.env.VITE_PASSPORT_SERVER_FALLBACK !== 'false';

export function isServerPassportFallbackEnabled(): boolean {
  return SERVER_FALLBACK_ENABLED;
}

/** Invoke Supabase Edge Function for Persona/Veriff or server-side MRZ re-validation */
export async function verifyPassportViaServer(
  request: ServerVerifyRequest
): Promise<ServerPassportVerificationResponse | null> {
  if (!SERVER_FALLBACK_ENABLED) return null;

  try {
    const { supabase } = await import('../../lib/supabase');
    const { data, error } = await supabase.functions.invoke<ServerPassportVerificationResponse>(
      'verify-passport',
      { body: request }
    );

    if (error) {
      console.warn('Server passport verification unavailable:', error.message);
      return null;
    }

    return data ?? null;
  } catch (err) {
    console.warn('Server passport verification failed:', err);
    return null;
  }
}

/** Merge server verification into client result (upgrade tier / fallback) */
export function mergeServerVerification(
  client: PassportVerificationResult,
  server: ServerPassportVerificationResponse
): PassportVerificationResult {
  const warnings = [...client.warnings];
  const errors = [...client.errors.filter((e) => !e.includes('MRZ'))];

  if (server.message) warnings.push(server.message);
  if (server.error) errors.push(server.error);

  let mrz = client.mrz;
  if (server.mrz && (!mrz || !mrz.checkDigitsValid)) {
    mrz = {
      documentCode: 'P',
      issuingCountry: '',
      surname: server.mrz.surname,
      givenNames: server.mrz.givenNames,
      passportNumber: server.mrz.passportNumber,
      nationality: server.mrz.nationality,
      dateOfBirth: server.mrz.dateOfBirth,
      sex: '',
      expiryDate: server.mrz.expiryDate,
      rawLines: client.mrz?.rawLines ?? ['', ''],
      checkDigitsValid: server.mrz.checkDigitsValid,
      corrected: false,
    };
  }

  const trustScore = Math.max(client.trustScore, server.trustScore);
  let status = client.status;
  if (server.status === 'verified' && trustScore >= 70) status = 'verified';
  else if (server.status === 'partial' && status === 'failed') status = 'partial';
  else if (server.status === 'pending') status = 'manual_review';

  const tier =
    server.provider === 'persona' || server.provider === 'veriff'
      ? 'third_party'
      : client.tier;

  if (server.sessionUrl) {
    warnings.push(`Complete hosted verification: ${server.sessionUrl}`);
  }

  return {
    ...client,
    status,
    trustScore,
    tier,
    mrz,
    warnings,
    errors,
  };
}
