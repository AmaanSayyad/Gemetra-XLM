import { supabase } from '../lib/supabase';
import { TREASURY_PUBLIC_KEY } from '../config/treasury';

export type TreasuryPayoutType = 'vat_refund' | 'points';

export type TreasuryErrorCode =
  | 'TREASURY_LOW_BALANCE'
  | 'TREASURY_NOT_CONFIGURED'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN';

export interface TreasuryPayoutRequest {
  paymentId?: string;
  recipientAddress: string;
  amount: number;
  memo?: string;
  payoutType?: TreasuryPayoutType;
  callerWallet?: string;
}

export interface TreasuryPayoutResponse {
  ok: boolean;
  txHash?: string;
  ledger?: number;
  sourceAddress?: string;
  alreadyPaid?: boolean;
  error?: string;
  code?: TreasuryErrorCode;
}

export interface ClassifiedTreasuryError {
  code: TreasuryErrorCode;
  message: string;
  userMessage: string;
  contactSupport: boolean;
}

const LOW_BALANCE_PATTERNS = [
  'treasury_low_balance',
  'underfunded',
  'op_underfunded',
  'insufficient',
  'low balance',
  'balance too low',
  'not enough xlm',
];

export function classifyTreasuryError(
  raw: string,
  responseCode?: string
): ClassifiedTreasuryError {
  const lower = raw.toLowerCase();

  if (
    responseCode === 'TREASURY_LOW_BALANCE' ||
    LOW_BALANCE_PATTERNS.some((p) => lower.includes(p))
  ) {
    return {
      code: 'TREASURY_LOW_BALANCE',
      message: raw,
      userMessage:
        'The treasury has insufficient XLM for this payout. Your claim has been saved — please contact support.',
      contactSupport: true,
    };
  }

  if (
    responseCode === 'TREASURY_NOT_CONFIGURED' ||
    lower.includes('treasury secret not configured') ||
    lower.includes('invalid treasury secret')
  ) {
    return {
      code: 'TREASURY_NOT_CONFIGURED',
      message: raw,
      userMessage:
        'Treasury payout is not configured yet. Please contact support.',
      contactSupport: true,
    };
  }

  if (
    lower.includes('failed to send a request') ||
    lower.includes('edge function') ||
    lower.includes('cors') ||
    lower.includes('networkerror') ||
    lower.includes('fetch failed')
  ) {
    return {
      code: 'SERVICE_UNAVAILABLE',
      message: raw,
      userMessage:
        'Treasury payout service is temporarily unavailable. Please contact support.',
      contactSupport: true,
    };
  }

  return {
    code: 'UNKNOWN',
    message: raw,
    userMessage: raw || 'Payout failed. Please try again or contact support.',
    contactSupport: true,
  };
}

async function parseInvokeError(error: unknown): Promise<{ message: string; code?: string }> {
  const fallback =
    error instanceof Error ? error.message : 'Treasury payout request failed';

  const fnError = error as { context?: Response; message?: string };
  if (fnError.context instanceof Response) {
    try {
      const body = (await fnError.context.json()) as {
        error?: string;
        code?: string;
      };
      return {
        message: body.error || fnError.message || fallback,
        code: body.code,
      };
    } catch {
      /* response body not JSON */
    }
  }

  return { message: fnError.message || fallback };
}

/** Request an XLM payout from the Gemetra treasury via Supabase Edge Function. */
export async function requestTreasuryPayout(
  request: TreasuryPayoutRequest
): Promise<TreasuryPayoutResponse> {
  const useSupabaseInDev = import.meta.env.VITE_USE_SUPABASE_TREASURY === 'true';

  if (import.meta.env.DEV && !useSupabaseInDev) {
    const response = await fetch('/api/dev/treasury-payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    let data: TreasuryPayoutResponse;
    try {
      data = (await response.json()) as TreasuryPayoutResponse;
    } catch {
      return {
        ok: false,
        error: 'Invalid response from local treasury payout service',
        code: 'SERVICE_UNAVAILABLE',
      };
    }

    if (!data.ok && data.error) {
      const classified = classifyTreasuryError(data.error, data.code);
      return { ...data, error: classified.userMessage, code: classified.code };
    }

    return data;
  }

  const { data, error } = await supabase.functions.invoke<TreasuryPayoutResponse>(
    'treasury-payout',
    { body: request }
  );

  if (error) {
    const parsed = await parseInvokeError(error);
    const classified = classifyTreasuryError(parsed.message, parsed.code);
    return {
      ok: false,
      error: classified.userMessage,
      code: classified.code,
    };
  }

  if (!data) {
    return {
      ok: false,
      error: 'Empty response from treasury payout service',
      code: 'SERVICE_UNAVAILABLE',
    };
  }

  if (!data.ok && data.error) {
    const classified = classifyTreasuryError(data.error, data.code);
    return {
      ...data,
      error: classified.userMessage,
      code: classified.code,
    };
  }

  return data;
}

export function getConfiguredTreasuryAddress(): string {
  return TREASURY_PUBLIC_KEY;
}

export function isTreasuryLowBalanceError(code?: TreasuryErrorCode, message?: string | null): boolean {
  if (code === 'TREASURY_LOW_BALANCE') return true;
  if (!message) return false;
  return classifyTreasuryError(message).code === 'TREASURY_LOW_BALANCE';
}
