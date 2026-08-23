/** Tourist rewards — earn Gemetra Points on every successful VAT claim */

export const POINTS_PER_VAT_CLAIM_BASE = 25;
export const POINTS_PER_XLM_REFUNDED = 10;
export const POINTS_CONVERSION_RATE = 100; // 100 points = 1 XLM bonus

/** Points earned for a completed VAT refund claim */
export function calculateVatClaimPoints(refundAmountXlm: number): number {
  const safeAmount = Number.isFinite(refundAmountXlm) && refundAmountXlm > 0 ? refundAmountXlm : 0;
  const amountBonus = Math.floor(safeAmount * POINTS_PER_XLM_REFUNDED);
  return POINTS_PER_VAT_CLAIM_BASE + amountBonus;
}

export function formatPointsEarnedMessage(points: number): string {
  return `+${points} Gemetra Points earned for this claim`;
}

export function pointsForRefundTx(
  transactions: { source_id?: string; source: string; points: number }[],
  txHash?: string
): number | null {
  if (!txHash) return null;
  const match = transactions.find(
    (t) => t.source === 'vat_refund' && t.source_id === txHash && t.points > 0
  );
  return match ? match.points : null;
}
