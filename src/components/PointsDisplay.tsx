import React, { useState } from 'react';
import { Sparkles, X, Gift, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePoints } from '../hooks/usePoints';
import { formatStellarAddress, isValidStellarAddress } from '../utils/stellar';
import { POINTS_CONVERSION_RATE, POINTS_PER_VAT_CLAIM_BASE } from '../utils/travelerPoints';
import { GemetraButton } from '../gemetra-ui';

interface PointsDisplayProps {
  walletAddress: string;
  isWalletConnected: boolean;
  onViewRefunds?: () => void;
}

/** Traveler rewards badge — earn points on every VAT claim */
export const PointsDisplay: React.FC<PointsDisplayProps> = ({
  walletAddress,
  isWalletConnected,
  onViewRefunds,
}) => {
  const { userPoints, transactions, convertPointsToXlm, loading } = usePoints();
  const [open, setOpen] = useState(false);
  const [pointsToConvert, setPointsToConvert] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  const totalPoints = userPoints?.total_points || 0;
  const lifetimePoints = userPoints?.lifetime_points || 0;
  const xlmEquivalent = totalPoints / POINTS_CONVERSION_RATE;

  const vatTransactions = transactions.filter((t) => t.source === 'vat_refund');

  const handleConvert = async () => {
    const points = parseFloat(pointsToConvert);
    if (!points || points < POINTS_CONVERSION_RATE) {
      setConversionError(`Minimum ${POINTS_CONVERSION_RATE} points to redeem`);
      return;
    }
    if (points > totalPoints) {
      setConversionError('Not enough points');
      return;
    }

    setIsConverting(true);
    setConversionError(null);
    try {
      const result = await convertPointsToXlm(points, walletAddress);
      alert(
        `Redeemed ${points} points for ${result.xlmAmount.toFixed(7)} XLM.\nRemaining: ${result.remainingPoints} points`
      );
      setPointsToConvert('');
    } catch (err) {
      setConversionError(err instanceof Error ? err.message : 'Redemption failed');
    } finally {
      setIsConverting(false);
    }
  };

  if (!isWalletConnected) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-[var(--gem-border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--gem-text)] shadow-sm transition hover:border-[var(--gem-brand)] hover:shadow-md sm:px-4 sm:py-2"
      >
        <Sparkles className="h-4 w-4 text-[var(--gem-brand)]" />
        <span>{totalPoints.toLocaleString()}</span>
        <span className="hidden text-xs font-medium text-[var(--gem-text-muted)] sm:inline">pts</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-[var(--gem-text)]">Traveler rewards</h3>
                  <p className="mt-1 text-sm text-[var(--gem-text-muted)]">
                    Earn {POINTS_PER_VAT_CLAIM_BASE}+ points every time you claim VAT
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 hover:bg-[var(--gem-surface-muted)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[var(--gem-brand-soft)] p-4">
                  <p className="text-xs font-medium text-[var(--gem-brand)]">Balance</p>
                  <p className="text-2xl font-bold text-[var(--gem-text)]">{totalPoints.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-[var(--gem-surface-muted)] p-4">
                  <p className="text-xs font-medium text-[var(--gem-text-muted)]">Lifetime</p>
                  <p className="text-2xl font-bold text-[var(--gem-text)]">{lifetimePoints.toLocaleString()}</p>
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-[var(--gem-border)] p-4">
                <p className="text-xs font-medium text-[var(--gem-text-muted)]">Redeem for bonus XLM</p>
                <p className="mt-1 text-sm text-[var(--gem-text)]">
                  {POINTS_CONVERSION_RATE} points = 1 XLM · ≈ {xlmEquivalent.toFixed(4)} XLM available
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    min={POINTS_CONVERSION_RATE}
                    max={totalPoints}
                    value={pointsToConvert}
                    onChange={(e) => {
                      setPointsToConvert(e.target.value);
                      setConversionError(null);
                    }}
                    placeholder={`Min ${POINTS_CONVERSION_RATE}`}
                    className="flex-1 rounded-xl border border-[var(--gem-border)] px-3 py-2 text-sm outline-none focus:border-[var(--gem-brand)]"
                  />
                  <GemetraButton
                    size="sm"
                    onClick={handleConvert}
                    disabled={isConverting || loading || totalPoints < POINTS_CONVERSION_RATE}
                  >
                    {isConverting ? '…' : 'Redeem'}
                  </GemetraButton>
                </div>
                {conversionError && (
                  <p className="mt-2 text-xs text-red-600">{conversionError}</p>
                )}
              </div>

              <div className="mb-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--gem-text)]">Points from VAT claims</h4>
                  {onViewRefunds && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onViewRefunds();
                      }}
                      className="text-xs font-medium text-[var(--gem-brand)] hover:underline"
                    >
                      View all refunds →
                    </button>
                  )}
                </div>

                {vatTransactions.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--gem-surface-muted)] py-8 text-center text-sm text-[var(--gem-text-muted)]">
                    <Receipt className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    Complete your first VAT claim to start earning
                  </div>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {vatTransactions.slice(0, 12).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-xl border border-[var(--gem-border)] px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--gem-text)]">
                            {tx.description || 'VAT claim'}
                          </p>
                          <p className="text-[10px] text-[var(--gem-text-muted)]">
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-[var(--gem-brand)]">+{tx.points}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-center text-[10px] text-[var(--gem-text-muted)]">
                Wallet {formatStellarAddress(walletAddress)}
                {!isValidStellarAddress(walletAddress) ? '' : ''}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
