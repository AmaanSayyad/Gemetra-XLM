import React from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import { useVatRefundEvents } from '../hooks/useVatRefundEvents';
import { getCurrentNetwork } from '../config/stellar';
import { getVatRefundContractId } from '../services/vatRefundOnchain';

export const ContractEventFeed: React.FC = () => {
  const { events, error, loading, refresh, enabled } = useVatRefundEvents();
  const network = getCurrentNetwork() === 'mainnet' ? 'public' : 'testnet';
  const contractId = getVatRefundContractId();

  return (
    <div className="stat-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-[var(--gem-brand)]" />
          <h3 className="text-base font-semibold text-[var(--gem-text)] sm:text-lg">
            On-chain claim events
          </h3>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="p-1 text-[var(--gem-text-muted)] hover:text-[var(--gem-brand)]"
          aria-label="Refresh contract events"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="mb-3 text-xs text-[var(--gem-text-muted)]">
        Live poll of <code className="font-mono">ClaimSubmitted</code> /{' '}
        <code className="font-mono">ClaimStatusChanged</code> from the vat-refund
        contract{contractId ? ` (${contractId.slice(0, 6)}…${contractId.slice(-4)})` : ''}.
      </p>

      {!enabled && (
        <p className="text-sm text-[var(--gem-text-muted)]">
          Set <code>VITE_VAT_REFUND_CONTRACT_ID</code> to stream Soroban events.
        </p>
      )}

      {error && (
        <p className="mb-3 text-sm text-red-600">{error}</p>
      )}

      {enabled && events.length === 0 && !loading && !error && (
        <p className="text-sm text-[var(--gem-text-muted)]">
          No recent contract events in the RPC window. Submit a claim with on-chain
          mode enabled to see live updates.
        </p>
      )}

      <ul className="space-y-2">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="rounded-xl border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--gem-text)]">{ev.name}</span>
              <span className="text-xs text-[var(--gem-text-muted)]">ledger {ev.ledger}</span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--gem-text-muted)]">
              {ev.claimId != null ? `Claim #${ev.claimId}` : 'Claim id n/a'}
              {ev.statusLabel ? ` · ${ev.statusLabel}` : ''}
            </p>
            {ev.txHash && (
              <a
                href={`https://stellar.expert/explorer/${network}/tx/${ev.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-mono text-xs text-[var(--gem-brand)] hover:underline"
              >
                {ev.txHash.slice(0, 10)}…{ev.txHash.slice(-6)}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
