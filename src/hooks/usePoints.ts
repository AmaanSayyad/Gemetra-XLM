import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { UserPoints, PointTransaction, PointConversion } from '../lib/supabase';
import type { Payment } from '../lib/supabase';
import { useStellarWallet } from '../utils/stellar-wallet';
import { requestTreasuryPayout } from '../services/treasuryPayout';
import {
  calculateVatClaimPoints,
  POINTS_CONVERSION_RATE,
  POINTS_PER_VAT_CLAIM_BASE,
} from '../utils/travelerPoints';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const POINTS_RULES = {
  vat_refund_base: POINTS_PER_VAT_CLAIM_BASE,
  vat_refund_per_xlm: 10,
};

export const usePoints = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { walletState } = useStellarWallet();

  useEffect(() => {
    if (walletState.isConnected && walletState.publicKey) {
      setWalletAddress(walletState.publicKey);
    } else {
      setWalletAddress(null);
      setUserPoints(null);
      setTransactions([]);
    }
  }, [walletState.isConnected, walletState.publicKey]);

  const persistPoints = useCallback((points: UserPoints) => {
    if (!walletAddress) return;
    localStorage.setItem(`gemetra_points_${walletAddress}`, JSON.stringify(points));
  }, [walletAddress]);

  const persistTransactions = useCallback((txs: PointTransaction[]) => {
    if (!walletAddress) return;
    localStorage.setItem(`gemetra_point_transactions_${walletAddress}`, JSON.stringify(txs));
  }, [walletAddress]);

  const initializePoints = useCallback(() => {
    if (!walletAddress) return;

    const newPoints: UserPoints = {
      id: generateUUID(),
      user_id: walletAddress,
      total_points: 0,
      lifetime_points: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setUserPoints(newPoints);
    persistPoints(newPoints);
  }, [walletAddress, persistPoints]);

  const loadFromStorage = useCallback(() => {
    if (!walletAddress) return;

    const storedPoints = localStorage.getItem(`gemetra_points_${walletAddress}`);
    if (storedPoints) {
      try {
        setUserPoints(JSON.parse(storedPoints));
      } catch {
        initializePoints();
      }
    } else {
      initializePoints();
    }

    const storedTx = localStorage.getItem(`gemetra_point_transactions_${walletAddress}`);
    if (storedTx) {
      try {
        setTransactions(JSON.parse(storedTx));
      } catch {
        setTransactions([]);
      }
    }
  }, [walletAddress, initializePoints]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    const refresh = () => loadFromStorage();
    window.addEventListener('pointsUpdated', refresh);
    return () => window.removeEventListener('pointsUpdated', refresh);
  }, [loadFromStorage]);

  const hasEarnedForSource = useCallback(
    (sourceId: string, source: PointTransaction['source']) =>
      transactions.some((t) => t.source_id === sourceId && t.source === source && t.points > 0),
    [transactions]
  );

  const earnPoints = useCallback(
    async (
      points: number,
      source: PointTransaction['source'],
      sourceId?: string,
      description?: string
    ): Promise<PointTransaction | null> => {
      if (!walletAddress) {
        console.warn('Cannot earn points: wallet not connected');
        return null;
      }

      if (points <= 0) return null;

      if (sourceId && hasEarnedForSource(sourceId, source)) {
        console.log(`Points already awarded for ${sourceId}`);
        return null;
      }

      try {
        setLoading(true);

        const transaction: PointTransaction = {
          id: generateUUID(),
          user_id: walletAddress,
          points,
          transaction_type: 'earned',
          source,
          source_id: sourceId,
          description: description || `Earned ${points} points`,
          created_at: new Date().toISOString(),
        };

        let nextPoints: UserPoints | null = null;

        setUserPoints((prev) => {
          if (!prev) {
            nextPoints = {
              id: generateUUID(),
              user_id: walletAddress,
              total_points: points,
              lifetime_points: points,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          } else {
            nextPoints = {
              ...prev,
              total_points: prev.total_points + points,
              lifetime_points: prev.lifetime_points + points,
              updated_at: new Date().toISOString(),
            };
          }
          persistPoints(nextPoints);
          return nextPoints;
        });

        setTransactions((prev) => {
          const updated = [transaction, ...prev];
          persistTransactions(updated);
          return updated;
        });

        try {
          if (nextPoints) {
            await supabase.from('user_points').upsert(
              {
                user_id: walletAddress,
                total_points: nextPoints.total_points,
                lifetime_points: nextPoints.lifetime_points,
              },
              { onConflict: 'user_id' }
            );
          }
          await supabase.from('point_transactions').insert([transaction]);
        } catch (supabaseError) {
          console.error('Failed to save points to Supabase (continuing anyway):', supabaseError);
        }

        window.dispatchEvent(new Event('pointsUpdated'));
        return transaction;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to earn points';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [walletAddress, hasEarnedForSource, persistPoints, persistTransactions]
  );

  const earnPointsForVatClaim = useCallback(
    async (refundAmountXlm: number, txHash: string) => {
      const points = calculateVatClaimPoints(refundAmountXlm);
      return earnPoints(
        points,
        'vat_refund',
        txHash,
        `VAT claim · +${points} pts (${refundAmountXlm.toFixed(4)} XLM refunded)`
      );
    },
    [earnPoints]
  );

  /** Backfill points for completed VAT refunds that were never rewarded */
  const syncVatRefundPoints = useCallback(
    async (completedRefunds: Payment[]) => {
      for (const refund of completedRefunds) {
        if (refund.status !== 'completed' || !refund.transaction_hash) continue;
        if (hasEarnedForSource(refund.transaction_hash, 'vat_refund')) continue;
        await earnPointsForVatClaim(refund.amount, refund.transaction_hash);
      }
    },
    [hasEarnedForSource, earnPointsForVatClaim]
  );

  const convertPointsToXlm = useCallback(
    async (pointsToConvert: number, recipientAddress?: string) => {
      if (!walletAddress) throw new Error('Wallet not connected');
      if (!userPoints || userPoints.total_points < pointsToConvert) {
        throw new Error('Insufficient points');
      }
      if (pointsToConvert < POINTS_CONVERSION_RATE) {
        throw new Error(`Minimum ${POINTS_CONVERSION_RATE} points required for conversion`);
      }

      const finalRecipientAddress = recipientAddress || walletAddress;

      try {
        setLoading(true);
        const xlmAmount = pointsToConvert / POINTS_CONVERSION_RATE;

        const conversion: PointConversion = {
          id: generateUUID(),
          user_id: walletAddress,
          points: pointsToConvert,
          xlm_amount: xlmAmount,
          conversion_rate: POINTS_CONVERSION_RATE,
          status: 'pending',
          created_at: new Date().toISOString(),
        };

        let actualTxHash: string | undefined;
        let conversionStatus: 'pending' | 'completed' | 'failed' = 'pending';

        try {
          const payout = await requestTreasuryPayout({
            recipientAddress: finalRecipientAddress,
            amount: xlmAmount,
            memo: `Gemetra points: ${pointsToConvert} pts`,
            payoutType: 'points',
            callerWallet: walletAddress,
          });

          if (payout.ok && payout.txHash) {
            actualTxHash = payout.txHash;
            conversionStatus = 'completed';
          } else {
            conversionStatus = 'failed';
          }
        } catch {
          conversionStatus = 'pending';
        }

        let nextTotal = 0;
        setUserPoints((prev) => {
          if (!prev) throw new Error('Points not initialized');
          const updated = {
            ...prev,
            total_points: prev.total_points - pointsToConvert,
            updated_at: new Date().toISOString(),
          };
          nextTotal = updated.total_points;
          persistPoints(updated);
          return updated;
        });

        const transaction: PointTransaction = {
          id: generateUUID(),
          user_id: walletAddress,
          points: -pointsToConvert,
          transaction_type: 'converted',
          source: 'conversion',
          source_id: conversion.id,
          description: `Redeemed ${pointsToConvert} points → ${xlmAmount.toFixed(7)} XLM`,
          created_at: new Date().toISOString(),
        };

        setTransactions((prev) => {
          const updated = [transaction, ...prev];
          persistTransactions(updated);
          return updated;
        });

        try {
          conversion.status = conversionStatus;
          conversion.completed_at =
            conversionStatus === 'completed' ? new Date().toISOString() : undefined;
          conversion.transaction_hash =
            actualTxHash ||
            (conversionStatus === 'pending' ? `pending_${generateUUID()}` : undefined);

          await supabase.from('point_conversions').insert([conversion]);
          await supabase.from('point_transactions').insert([transaction]);
          await supabase.from('user_points').upsert(
            {
              user_id: walletAddress,
              total_points: nextTotal,
              lifetime_points: userPoints.lifetime_points,
            },
            { onConflict: 'user_id' }
          );
        } catch (supabaseError) {
          console.error('Failed to save conversion to Supabase:', supabaseError);
        }

        window.dispatchEvent(new Event('pointsUpdated'));

        return {
          conversion,
          xlmAmount,
          remainingPoints: nextTotal,
          transactionHash: actualTxHash || conversion.transaction_hash,
          status: conversionStatus,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to convert points';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [walletAddress, userPoints, persistPoints, persistTransactions]
  );

  const getPointsForVatClaim = useCallback((refundAmountXlm: number) => {
    return calculateVatClaimPoints(refundAmountXlm);
  }, []);

  return {
    userPoints,
    transactions,
    loading,
    error,
    earnPoints,
    earnPointsForVatClaim,
    syncVatRefundPoints,
    convertPointsToXlm,
    getPointsForVatClaim,
    conversionRate: POINTS_CONVERSION_RATE,
    pointsRules: POINTS_RULES,
  };
};
