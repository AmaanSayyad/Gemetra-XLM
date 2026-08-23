import React, { useMemo, useEffect, useState } from 'react';
import { Clock, CheckCircle, Receipt, ExternalLink } from 'lucide-react';
import { usePayments } from '../hooks/usePayments';
import type { Payment } from '../lib/supabase';

interface Activity {
  id: string;
  title: string;
  description: string;
  time: string;
  status: string;
  amount: string | null;
  date: Date;
  payment: Payment;
}

interface RecentActivityProps {
  onViewAllClick?: () => void;
  refreshKey?: number;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  onViewAllClick,
  refreshKey = 0,
}) => {
  const { getAllPayments, getExplorerLink, getBlockchainTypeBadge } = usePayments();
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const allPayments = await getAllPayments();
        setPayments(allPayments.filter((p) => p.employee_id === 'vat-refund'));
      } catch (error) {
        console.error('RecentActivity: Failed to fetch payments:', error);
        setPayments([]);
      }
    };

    fetchPayments();
  }, [getAllPayments, refreshKey]);

  const formatTimeAgo = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  const activities = useMemo(() => {
    return payments
      .map((payment): Activity => {
        const merchant = payment.vat_refund_details?.merchantName;
        const receipt = payment.vat_refund_details?.receiptNo;
        const description = merchant
          ? `VAT refund${receipt ? ` · receipt ${receipt}` : ''} — ${merchant}`
          : 'VAT refund claim';

        return {
          id: `refund-${payment.id}`,
          title: payment.status === 'completed' ? 'Refund Completed' : 'Refund Submitted',
          description,
          time: formatTimeAgo(new Date(payment.payment_date || payment.created_at)),
          status: payment.status,
          amount: `${payment.amount.toLocaleString()} ${payment.token}`,
          date: new Date(payment.payment_date || payment.created_at),
          payment,
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 3);
  }, [payments]);

  const getStatusIcon = (status: string) => {
    if (status === 'completed') {
      return <CheckCircle className="h-4 w-4 text-[var(--gem-success)]" />;
    }
    return <Clock className="h-4 w-4 text-amber-500" />;
  };

  return (
    <div className="stat-card">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[var(--gem-text-muted)]" />
          <h3 className="text-base font-semibold text-[var(--gem-text)] sm:text-lg">Recent VAT Activity</h3>
        </div>
        <div className="text-xs text-[var(--gem-text-muted)] sm:text-sm">Last 30 days</div>
      </div>

      {activities.length > 0 ? (
        <div className="space-y-3 sm:space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 rounded-[var(--gem-radius-sm)] border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] p-3 sm:gap-4 sm:p-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white sm:h-10 sm:w-10">
                <Receipt className="h-4 w-4 text-[var(--gem-brand)] sm:h-5 sm:w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <h4 className="truncate text-sm font-medium text-[var(--gem-text)]">{activity.title}</h4>
                  {getStatusIcon(activity.status)}
                </div>

                <p className="mb-2 text-xs text-[var(--gem-text-muted)] sm:text-sm">{activity.description}</p>

                {activity.payment.transaction_hash && (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {(() => {
                      const badge = getBlockchainTypeBadge(activity.payment);
                      return (
                        <span className="rounded-full bg-[var(--gem-brand-soft)] px-2 py-0.5 text-xs font-medium text-[var(--gem-brand)]">
                          {badge.label}
                        </span>
                      );
                    })()}
                    <a
                      href={getExplorerLink(activity.payment) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--gem-brand)] hover:underline"
                    >
                      <span className="font-mono">
                        {activity.payment.transaction_hash.substring(0, 10)}…
                        {activity.payment.transaction_hash.substring(activity.payment.transaction_hash.length - 8)}
                      </span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--gem-text-muted)]">{activity.time}</span>
                  {activity.amount && (
                    <span className="text-xs font-medium text-[var(--gem-text)] sm:text-sm">{activity.amount}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center sm:py-10">
          <Clock className="mx-auto mb-3 h-10 w-10 text-[var(--gem-text-muted)]/40" />
          <h4 className="mb-1 text-base font-medium text-[var(--gem-text)] sm:text-lg">No activity yet</h4>
          <p className="text-sm text-[var(--gem-text-muted)]">Your refund submissions will appear here</p>
        </div>
      )}

      {activities.length > 0 && onViewAllClick && (
        <div className="mt-4 border-t border-[var(--gem-border)] pt-3 sm:mt-6 sm:pt-4">
          <button
            type="button"
            onClick={onViewAllClick}
            className="w-full text-center text-xs text-[var(--gem-text-muted)] transition hover:text-[var(--gem-text)] sm:text-sm"
          >
            View all activity →
          </button>
        </div>
      )}
    </div>
  );
};
