import { supabase } from '../lib/supabase';
import { isValidStellarAddress } from '../utils/stellar';

export interface ClaimBlacklistEntry {
  id: string;
  wallet_address: string;
  passport_no?: string | null;
  reason: string;
  blacklisted_by: string;
  source_payment_id?: string | null;
  created_at: string;
}

export interface BlacklistCheckResult {
  blocked: boolean;
  reason?: string;
  wallet?: string;
  passport?: string;
}

function normalizeWallet(address: string): string {
  return address.trim();
}

function normalizePassport(passport: string): string {
  return passport.trim().toUpperCase();
}

export async function fetchClaimBlacklist(): Promise<ClaimBlacklistEntry[]> {
  const { data, error } = await supabase
    .from('claim_blacklist')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch claim blacklist:', error);
    return [];
  }

  return (data || []) as ClaimBlacklistEntry[];
}

export async function isWalletBlacklisted(wallet: string): Promise<BlacklistCheckResult> {
  const normalized = normalizeWallet(wallet);
  if (!normalized) return { blocked: false };

  const { data, error } = await supabase
    .from('claim_blacklist')
    .select('reason, wallet_address')
    .ilike('wallet_address', normalized)
    .maybeSingle();

  if (error || !data) return { blocked: false };

  return {
    blocked: true,
    reason: data.reason,
    wallet: data.wallet_address,
  };
}

export async function isPassportBlacklisted(passport: string): Promise<BlacklistCheckResult> {
  const normalized = normalizePassport(passport);
  if (!normalized) return { blocked: false };

  const { data, error } = await supabase
    .from('claim_blacklist')
    .select('reason, passport_no')
    .eq('passport_no', normalized)
    .maybeSingle();

  if (error || !data) return { blocked: false };

  return {
    blocked: true,
    reason: data.reason,
    passport: data.passport_no ?? undefined,
  };
}

export async function checkClaimEligibility(
  wallet: string,
  passportNo?: string
): Promise<BlacklistCheckResult> {
  const walletCheck = await isWalletBlacklisted(wallet);
  if (walletCheck.blocked) return walletCheck;

  if (passportNo?.trim()) {
    return isPassportBlacklisted(passportNo);
  }

  return { blocked: false };
}

export async function addToClaimBlacklist(params: {
  walletAddress: string;
  passportNo?: string;
  reason: string;
  blacklistedBy: string;
  sourcePaymentId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const wallet = normalizeWallet(params.walletAddress);
  if (!isValidStellarAddress(wallet)) {
    return { ok: false, error: 'Invalid wallet address for blacklist' };
  }

  const reason = params.reason.trim();
  if (!reason) {
    return { ok: false, error: 'A reason is required to blacklist a claim' };
  }

  const { error } = await supabase.from('claim_blacklist').upsert(
    [
      {
        wallet_address: wallet,
        passport_no: params.passportNo?.trim()
          ? normalizePassport(params.passportNo)
          : null,
        reason,
        blacklisted_by: params.blacklistedBy,
        source_payment_id: params.sourcePaymentId ?? null,
      },
    ],
    { onConflict: 'wallet_address' }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function removeFromClaimBlacklist(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('claim_blacklist').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
