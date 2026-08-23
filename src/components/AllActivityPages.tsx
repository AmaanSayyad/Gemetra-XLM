import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Clock, CheckCircle, Receipt, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
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

interface AllActivityPageProps {
  onClose: () => void;
  refreshKey?: number;
}

export const AllActivityPage: React.FC<AllActivityPageProps> = ({ onClose, refreshKey = 0 }) => {
  const { getAllPayments, getExplorerLink, getBlockchainTypeBadge } = usePayments();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const allPayments = await getAllPayments();
        setPayments(allPayments.filter((p) => p.employee_id === 'vat-refund'));
      } catch (error) {
        console.error('Failed to fetch payments:', error);
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

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
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
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [payments]);

  const getStatusIcon = (status: string) => {
    if (status === 'completed') {
      return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />;
    }
    return <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600" />;
  };

  const totalPages = Math.ceil(activities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentActivities = activities.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50 sm:bg-white">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-8">
        <div className="mb-4 sm:mb-8">
          <button
            onClick={onClose}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors p-1 sm:p-0 mb-3 sm:mb-4"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base">Back</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">VAT Refund History</h1>
              <p className="text-gray-600 text-xs sm:text-sm mt-1">All submitted and completed refunds</p>
            </div>
            <div className="text-xs sm:text-sm text-gray-500 bg-gray-100 sm:bg-transparent px-2 py-1 sm:p-0 rounded-lg sm:rounded-none">
              {activities.length} refunds
            </div>
          </div>
        </div>

        {activities.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {currentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 sm:p-4">
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-sm sm:text-base font-medium text-gray-900 pr-2">{activity.title}</h4>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {getStatusIcon(activity.status)}
                        <span className="text-xs text-gray-500 hidden sm:inline">{activity.time}</span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-gray-600 mb-2 pr-2">{activity.description}</p>

                    {activity.payment.transaction_hash && (
                      <div className="mb-2 flex items-center space-x-2 flex-wrap">
                        {(() => {
                          const badge = getBlockchainTypeBadge(activity.payment);
                          const badgeColor =
                            badge.color === 'blue'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700';
                          return (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeColor}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                        <a
                          href={getExplorerLink(activity.payment) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <span className="font-mono">
                            {activity.payment.transaction_hash.substring(0, 10)}...
                            {activity.payment.transaction_hash.substring(activity.payment.transaction_hash.length - 8)}
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 sm:hidden">{activity.time}</span>
                      {activity.amount && (
                        <span className="text-sm sm:text-base font-semibold text-green-600">{activity.amount}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="border-t border-gray-200 bg-gray-50 px-3 py-3 sm:px-4 sm:py-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-600">Page {currentPage} of {totalPages}</div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="flex items-center justify-center w-8 h-8 text-gray-600 bg-white border border-gray-300 rounded-lg disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="flex items-center justify-center w-8 h-8 text-gray-600 bg-white border border-gray-300 rounded-lg disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 sm:py-16">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-medium text-gray-600 mb-2">No Refunds Yet</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Submit a VAT refund claim to build your refund history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
