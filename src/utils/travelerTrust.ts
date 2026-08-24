import type { Payment, VATRefundDetails } from '../lib/supabase';
import type { TimelineStep } from '../gemetra-ui';

export type TrustBand = 'excellent' | 'good' | 'fair' | 'at_risk' | 'blocked' | 'unverified';

export interface TravelerTrustProfile {
  score: number;
  band: TrustBand;
  label: string;
  summary: string;
  reasons: string[];
  avgPassportTrust: number | null;
  latestVerificationStatus: string | null;
  latestVerificationTier: string | null;
  verifiedClaimCount: number;
  mrzValidCount: number;
  skippedPassportCount: number;
  isBlacklisted: boolean;
  blacklistReason?: string;
}

export interface ClaimBlacklistIssue {
  id: string;
  reason: string;
  created_at: string;
  wallet_address?: string;
  passport_no?: string | null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function passportOf(claim: Payment): VATRefundDetails['passportVerification'] | undefined {
  return claim.vat_refund_details?.passportVerification;
}

export function trustBandForScore(score: number, isBlacklisted: boolean, hasPassportData: boolean): TrustBand {
  if (isBlacklisted) return 'blocked';
  if (!hasPassportData) return score < 35 ? 'unverified' : 'fair';
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score < 35) return 'at_risk';
  return 'fair';
}

export function trustLabel(band: TrustBand): string {
  switch (band) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good standing';
    case 'fair':
      return 'Fair';
    case 'at_risk':
      return 'Needs review';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Not verified';
  }
}

export function formatVerificationStatus(status?: string): string {
  if (!status) return 'Not submitted';
  if (status === 'manual') return 'Manual entry';
  return status.replace(/_/g, ' ');
}

export function formatVerificationTier(tier?: string): string {
  switch (tier) {
    case 'client_gemini':
      return 'Passport + AI check';
    case 'third_party':
      return 'Third-party verified';
    case 'client_mrz':
      return 'MRZ checksum';
    case 'manual':
      return 'Manual details';
    default:
      return tier?.replace(/_/g, ' ') || 'None';
  }
}

/**
 * Traveler trust score from claim history + current blacklist state.
 * Sensitive documents stay off-chain; this only uses stored verification metadata.
 */
export function computeTravelerTrust(params: {
  claims: Payment[];
  blacklist?: ClaimBlacklistIssue | null;
}): TravelerTrustProfile {
  const claims = params.claims;
  const blacklist = params.blacklist ?? null;
  const isBlacklisted = Boolean(blacklist);
  const reasons: string[] = [];

  const passportScores = claims
    .map((c) => passportOf(c)?.trustScore)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));

  const avgPassportTrust =
    passportScores.length > 0
      ? Math.round(passportScores.reduce((a, b) => a + b, 0) / passportScores.length)
      : null;

  const latestWithPassport = claims.find((c) => passportOf(c));
  const latestPv = latestWithPassport ? passportOf(latestWithPassport) : undefined;

  const verifiedClaimCount = claims.filter((c) => passportOf(c)?.status === 'verified').length;
  const mrzValidCount = claims.filter((c) => passportOf(c)?.mrzValid === true).length;
  const skippedPassportCount = claims.filter((c) => {
    const pv = passportOf(c);
    return !pv || pv.status === 'manual' || pv.tier === 'manual';
  }).length;

  const completed = claims.filter((c) => c.status === 'completed').length;
  const failed = claims.filter((c) => c.status === 'failed').length;
  const cancelled = claims.filter((c) => c.status === 'cancelled').length;
  const blacklistedClaims = claims.filter((c) => c.status === 'blacklisted').length;

  if (claims.length === 0 && !isBlacklisted) {
    return {
      score: 0,
      band: 'unverified',
      label: trustLabel('unverified'),
      summary: 'Submit a claim with passport verification to start building your traveler profile.',
      reasons: ['No claims yet'],
      avgPassportTrust: null,
      latestVerificationStatus: null,
      latestVerificationTier: null,
      verifiedClaimCount: 0,
      mrzValidCount: 0,
      skippedPassportCount: 0,
      isBlacklisted: false,
    };
  }

  let score = 40;

  if (avgPassportTrust != null) {
    score += Math.round(avgPassportTrust * 0.35);
    reasons.push(`Passport verification average ${avgPassportTrust}%`);
  } else {
    reasons.push('No passport verification on file');
  }

  const completedBonus = Math.min(20, completed * 5);
  score += completedBonus;
  if (completed > 0) reasons.push(`${completed} paid claim${completed === 1 ? '' : 's'}`);

  const verifiedBonus = Math.min(12, verifiedClaimCount * 6);
  score += verifiedBonus;
  if (verifiedClaimCount > 0) reasons.push(`${verifiedClaimCount} verified passport${verifiedClaimCount === 1 ? '' : 's'}`);

  if (mrzValidCount > 0) {
    score += Math.min(6, mrzValidCount * 3);
    reasons.push('Valid MRZ checksums');
  }

  if (failed > 0) {
    score -= failed * 12;
    reasons.push(`${failed} failed payout${failed === 1 ? '' : 's'}`);
  }
  if (cancelled > 0) {
    score -= cancelled * 6;
    reasons.push(`${cancelled} cancelled claim${cancelled === 1 ? '' : 's'}`);
  }
  if (blacklistedClaims > 0) {
    score -= 25;
    reasons.push('A claim on this wallet was blacklisted');
  }
  if (skippedPassportCount > 0 && verifiedClaimCount === 0) {
    score -= 8;
    reasons.push('Passport skipped or entered manually');
  }

  if (isBlacklisted) {
    score = Math.min(score - 40, 18);
    reasons.push(blacklist?.reason ? `Blocked: ${blacklist.reason}` : 'Wallet is on the claim blocklist');
  }

  score = Math.round(clamp(score, 0, 100));
  const band = trustBandForScore(score, isBlacklisted, passportScores.length > 0);

  const summary = isBlacklisted
    ? 'This wallet cannot submit new claims until the block is lifted. Contact support if you believe this is a mistake.'
    : band === 'unverified'
      ? 'Add a passport scan on your next claim to raise verification quality.'
      : band === 'at_risk'
        ? 'Some claims need attention. Check failed, cancelled, or blocked items below.'
        : band === 'excellent'
          ? 'Strong verification history. Future claims should process with less friction.'
          : 'Keep submitting verified passports and completed refunds to improve this score.';

  return {
    score,
    band,
    label: trustLabel(band),
    summary,
    reasons,
    avgPassportTrust,
    latestVerificationStatus: latestPv?.status ?? null,
    latestVerificationTier: latestPv?.tier ?? null,
    verifiedClaimCount,
    mrzValidCount,
    skippedPassportCount,
    isBlacklisted,
    blacklistReason: blacklist?.reason,
  };
}

function formatWhen(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Per-claim status timeline: submitted → identity → review → payout / terminal state.
 */
export function buildClaimTimeline(claim: Payment): TimelineStep[] {
  const details = claim.vat_refund_details;
  const pv = details?.passportVerification;
  const status = claim.status;
  const submittedAt = formatWhen(claim.created_at);
  const paidAt = formatWhen(claim.payment_date);

  const identityDone = Boolean(pv && pv.status && pv.status !== 'failed');
  const identityFailed = pv?.status === 'failed';
  const identitySkipped = !pv || pv.status === 'manual' || pv.tier === 'manual';

  const terminal = status === 'cancelled' || status === 'blacklisted' || status === 'failed';
  const paid = status === 'completed';
  const pending = status === 'pending';

  const submitted: TimelineStep = {
    id: 'submitted',
    title: 'Claim submitted',
    description: details?.receiptNo
      ? `Receipt ${details.receiptNo}${details.claimCountryName ? ` · ${details.claimCountryName}` : ''}`
      : details?.claimCountryName || 'VAT refund claim registered',
    status: 'completed',
    timestamp: submittedAt,
  };

  let identityStatus: TimelineStep['status'] = 'pending';
  let identityTitle = 'Identity check';
  let identityDescription = 'Passport not verified yet';
  if (identityFailed) {
    identityStatus = terminal || paid ? 'completed' : 'current';
    identityTitle = 'Identity check failed';
    identityDescription = 'Passport verification did not pass';
  } else if (identityDone && !identitySkipped) {
    identityStatus = 'completed';
    identityTitle = pv?.status === 'verified' ? 'Passport verified' : 'Identity recorded';
    identityDescription = [
      pv?.trustScore != null ? `${pv.trustScore}% trust` : null,
      pv?.mrzValid ? 'MRZ valid' : null,
      formatVerificationTier(pv?.tier),
    ]
      .filter(Boolean)
      .join(' · ');
  } else if (identitySkipped && (paid || terminal || pending)) {
    identityStatus = paid || terminal ? 'completed' : pending ? 'current' : 'pending';
    identityTitle = 'Passport skipped';
    identityDescription = 'Traveler continued without a verified scan';
  } else if (pending) {
    identityStatus = 'current';
  }

  const identity: TimelineStep = {
    id: 'identity',
    title: identityTitle,
    description: identityDescription,
    status: identityStatus,
    timestamp: pv?.verifiedAt ? formatWhen(pv.verifiedAt) : undefined,
  };

  let reviewStatus: TimelineStep['status'] = 'pending';
  if (paid || terminal) reviewStatus = 'completed';
  else if (pending) reviewStatus = identityStatus === 'completed' || identityStatus === 'current' ? 'current' : 'pending';

  const review: TimelineStep = {
    id: 'review',
    title: terminal && status !== 'failed' ? 'Review closed' : 'Treasury review',
    description: paid
      ? 'Approved for XLM payout'
      : status === 'cancelled'
        ? details?.adminAction?.reason || 'Claim cancelled by operations'
        : status === 'blacklisted'
          ? details?.adminAction?.reason || 'Claim blocked'
          : pending
            ? 'Waiting for payout'
            : 'Under review',
    status: reviewStatus,
  };

  let payoutStatus: TimelineStep['status'] = 'pending';
  let payoutTitle = 'XLM payout';
  let payoutDescription = 'Treasury has not paid this claim yet';
  if (paid) {
    payoutStatus = 'completed';
    payoutTitle = 'Paid to wallet';
    payoutDescription = claim.transaction_hash
      ? 'On-chain payout confirmed'
      : 'Marked paid';
  } else if (status === 'failed') {
    payoutStatus = 'completed';
    payoutTitle = 'Payout failed';
    payoutDescription = 'Treasury transfer did not complete';
  } else if (status === 'cancelled') {
    payoutStatus = 'completed';
    payoutTitle = 'Payout cancelled';
    payoutDescription = 'No XLM was sent';
  } else if (status === 'blacklisted') {
    payoutStatus = 'completed';
    payoutTitle = 'Payout blocked';
    payoutDescription = 'Wallet or passport is on the blocklist';
  }

  const payout: TimelineStep = {
    id: 'payout',
    title: payoutTitle,
    description: payoutDescription,
    status: payoutStatus,
    timestamp: paid ? paidAt : details?.adminAction?.at ? formatWhen(details.adminAction.at) : undefined,
  };

  const steps = [submitted, identity, review, payout];

  if (details?.contractClaimId) {
    steps.splice(1, 0, {
      id: 'onchain',
      title: 'On-chain registry',
      description: `Soroban claim #${details.contractClaimId}`,
      status: 'completed',
    });
  }

  return steps;
}
