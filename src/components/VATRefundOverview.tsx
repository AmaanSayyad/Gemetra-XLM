import React, { useState, useEffect } from 'react';
import { getStellarExpertTxUrl } from '../utils/stellar';
import { Receipt, ArrowRight, Clock, CheckCircle, ExternalLink } from 'lucide-react';
import { usePayments } from '../hooks/usePayments';
import { GemetraButton } from '../gemetra-ui';

interface VATRefundOverviewProps {
  setActiveTab: (tab: string) => void;
  refreshKey?: number;
}

interface RefundStats {
  totalRefunded: number;
  pendingRefunds: number;
  pendingAmount: number;
  completedRefunds: number;
  averageProcessingTime: string;
  lastRefundDate: string;
}

interface RefundItem {
  id: string;
  date: string;
  amount: number;
  status: string;
  token: string;
  transaction_hash?: string;
}

export const VATRefundOverview: React.FC<VATRefundOverviewProps> = ({ setActiveTab, refreshKey = 0 }) => {
  const { getAllPayments } = usePayments();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<RefundStats>({
    totalRefunded: 0,
    pendingRefunds: 0,
    pendingAmount: 0,
    completedRefunds: 0,
    averageProcessingTime: '0 days',
    lastRefundDate: new Date().toISOString(),
  });
  const [recentRefunds, setRecentRefunds] = useState<RefundItem[]>([]);

  useEffect(() => {
    const fetchVATRefundData = async () => {
      setIsLoading(true);
      try {
        const allPayments = await getAllPayments();
        const vatRefunds = allPayments.filter((payment) => payment.employee_id === 'vat-refund');

        if (vatRefunds.length === 0) {
          setIsLoading(false);
          return;
        }

        const completedRefunds = vatRefunds.filter((payment) => payment.status === 'completed');
        const pendingRefunds = vatRefunds.filter((payment) => payment.status === 'pending');

        const totalRefunded = completedRefunds.reduce((sum, payment) => sum + payment.amount, 0);
        const pendingAmount = pendingRefunds.reduce((sum, payment) => sum + payment.amount, 0);
        const dates = vatRefunds.map((payment) => new Date(payment.created_at).getTime());
        const lastRefundDate = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : new Date().toISOString();

        setStats({
          totalRefunded,
          pendingRefunds: pendingRefunds.length,
          pendingAmount,
          completedRefunds: completedRefunds.length,
          averageProcessingTime: '1 day',
          lastRefundDate,
        });

        const sortedRefunds = [...vatRefunds]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3)
          .map((payment) => ({
            id: payment.id,
            date: payment.created_at,
            amount: payment.amount,
            status: payment.status,
            token: payment.token || 'XLM',
            transaction_hash: payment.transaction_hash,
          }));

        setRecentRefunds(sortedRefunds);
      } catch (error) {
        console.error('Failed to fetch VAT refund data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVATRefundData();
  }, [getAllPayments, refreshKey]);

  return (
    <div className="stat-card">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <h3 className="text-base font-semibold text-[var(--gem-text)] sm:text-lg">VAT Refund Overview</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--gem-border)] border-t-[var(--gem-brand)]" />
        </div>
      ) : recentRefunds.length === 0 ? (
        <div className="py-4 text-center">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-[var(--gem-text-muted)]/40" />
          <p className="font-medium text-[var(--gem-text)]">No VAT refunds yet</p>
          <p className="mt-1 text-sm text-[var(--gem-text-muted)]">
            Use Submit Refund above to upload your first receipt
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 space-y-4 sm:mb-6 sm:space-y-6">
            <div className="text-center">
              <div className="mb-2 text-xl font-bold text-[var(--gem-text)] sm:text-2xl">
                ${stats.totalRefunded.toLocaleString()}
              </div>
              <div className="text-xs text-[var(--gem-text-muted)] sm:text-sm">Total VAT Refunded</div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="rounded-[var(--gem-radius-sm)] border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] p-3 sm:p-4">
                <div className="text-center">
                  <div className="text-base font-bold text-[var(--gem-text)] sm:text-xl">{stats.pendingRefunds}</div>
                  <div className="text-xs text-[var(--gem-text-muted)] sm:text-sm">Pending</div>
                </div>
              </div>
              <div className="rounded-[var(--gem-radius-sm)] border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] p-3 sm:p-4">
                <div className="text-center">
                  <div className="text-base font-bold text-[var(--gem-text)] sm:text-xl">
                    ${stats.pendingAmount.toLocaleString()}
                  </div>
                  <div className="text-xs text-[var(--gem-text-muted)] sm:text-sm">Pending Amount</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 space-y-3 sm:mb-6 sm:space-y-4">
            <div className="rounded-[var(--gem-radius-sm)] border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] p-3 sm:p-4">
              <div className="mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--gem-brand)]" />
                <span className="text-xs font-medium text-[var(--gem-text)] sm:text-sm">Avg. processing time</span>
              </div>
              <div className="text-xs font-semibold text-[var(--gem-text)] sm:text-sm">{stats.averageProcessingTime}</div>
            </div>

            <div className="rounded-[var(--gem-radius-sm)] border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] p-3 sm:p-4">
              <div className="mb-2 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[var(--gem-brand)]" />
                <span className="text-xs font-medium text-[var(--gem-text)] sm:text-sm">Recent refunds</span>
              </div>
              <div className="space-y-2">
                {recentRefunds.map((refund) => (
                  <div key={refund.id} className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      {refund.status === 'completed' ? (
                        <CheckCircle className="h-3 w-3 text-[var(--gem-success)]" />
                      ) : (
                        <Clock className="h-3 w-3 text-amber-500" />
                      )}
                      <span className="text-[var(--gem-text-muted)]">{refund.id.slice(0, 8)}…</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--gem-text)]">
                        {refund.amount.toFixed(2)} {refund.token}
                      </span>
                      {refund.transaction_hash && (
                        <a
                          href={getStellarExpertTxUrl(refund.transaction_hash, 'mainnet')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--gem-brand)] hover:text-[var(--gem-brand-hover)]"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <GemetraButton
            className="w-full"
            onClick={() => setActiveTab('vat-refund')}
            icon={<ArrowRight className="h-4 w-4" />}
          >
            New refund
          </GemetraButton>
        </>
      )}
    </div>
  );
};
