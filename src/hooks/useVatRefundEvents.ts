import { useCallback, useEffect, useState } from 'react';
import { fetchVatRefundEvents, type VatContractEvent } from '../services/vatRefundEvents';
import { getVatRefundContractId } from '../services/vatRefundOnchain';

const POLL_MS = 8_000;

export function useVatRefundEvents() {
  const [events, setEvents] = useState<VatContractEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const enabled = Boolean(getVatRefundContractId());

  const refresh = useCallback(async () => {
    if (!getVatRefundContractId()) {
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchVatRefundEvents();
      setEvents(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contract events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!enabled) return;
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  return { events, error, loading, refresh, enabled };
}
