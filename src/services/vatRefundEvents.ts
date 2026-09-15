import * as StellarSdk from '@stellar/stellar-sdk';
import { getVatRefundContractId, getSorobanRpcUrl } from './vatRefundOnchain';

export const CLAIM_STATUS_LABELS: Record<number, string> = {
  0: 'Pending',
  1: 'Approved',
  2: 'Paid',
  3: 'Government submitted',
  4: 'Government approved',
  5: 'Government rejected',
  6: 'Treasury reimbursed',
  7: 'Cancelled',
  8: 'Blacklisted',
};

export interface VatContractEvent {
  id: string;
  ledger: number;
  txHash?: string;
  name: string;
  claimId?: number;
  statusLabel?: string;
  contractId: string;
}

function scValToPlain(val: unknown): unknown {
  if (val == null) return val;
  if (
    typeof val === 'string' ||
    typeof val === 'number' ||
    typeof val === 'boolean' ||
    typeof val === 'bigint'
  ) {
    return val;
  }
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object' && Object.getPrototypeOf(val) === Object.prototype) {
    return val;
  }
  try {
    const native = StellarSdk.scValToNative(val as StellarSdk.xdr.ScVal);
    if (typeof native === 'bigint') return Number(native);
    return native;
  } catch {
    return String(val);
  }
}

function asClaimId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1_000_000) {
    return value;
  }
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    if (n > 0 && n < 1_000_000) return n;
  }
  return undefined;
}

function eventNameFromTopics(topics: unknown[]): string {
  const first = topics[0];
  if (typeof first === 'string' && first.length > 0) return first;
  if (first && typeof first === 'object') {
    const plain = scValToPlain(first);
    if (typeof plain === 'string') return plain;
  }
  return 'contract_event';
}

export function parseVatRefundEvent(raw: {
  id?: string;
  ledger?: number;
  txHash?: string | null;
  contractId?: string;
  topic?: unknown[];
  value?: unknown;
}): VatContractEvent | null {
  const topics = Array.isArray(raw.topic) ? raw.topic : [];
  const name = eventNameFromTopics(topics.map(scValToPlain));
  const value = scValToPlain(raw.value);
  let claimId: number | undefined;
  let statusLabel: string | undefined;

  const topicPlain = topics.map(scValToPlain);
  for (const t of topicPlain) {
    const id = asClaimId(t);
    if (id != null) {
      claimId = id;
      break;
    }
  }

  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const fromValue = asClaimId(rec.claim_id);
    if (fromValue != null) claimId = fromValue;
    if (typeof rec.status === 'number') statusLabel = CLAIM_STATUS_LABELS[rec.status] ?? `status ${rec.status}`;
    if (typeof rec.status === 'string') statusLabel = rec.status;
  }

  if (!raw.id && !raw.ledger) return null;

  return {
    id: String(raw.id ?? `${raw.ledger}-${name}-${claimId ?? 0}`),
    ledger: Number(raw.ledger ?? 0),
    txHash: raw.txHash || undefined,
    name,
    claimId,
    statusLabel,
    contractId: String(raw.contractId ?? ''),
  };
}

export async function fetchVatRefundEvents(limit = 20): Promise<VatContractEvent[]> {
  const contractId = getVatRefundContractId();
  const rpcUrl = getSorobanRpcUrl();
  if (!contractId || !rpcUrl) return [];

  const rpc = new StellarSdk.rpc.Server(rpcUrl, { allowHttp: false });
  const latest = await rpc.getLatestLedger();
  const startLedger = Math.max(1, latest.sequence - 10_000);

  const page = await rpc.getEvents({
    startLedger,
    filters: [
      {
        type: 'contract',
        contractIds: [contractId],
      },
    ],
    limit,
  });

  return (page.events ?? [])
    .map((ev) =>
      parseVatRefundEvent({
        id: ev.id,
        ledger: ev.ledger,
        txHash: ev.txHash,
        contractId: ev.contractId,
        topic: ev.topic,
        value: ev.value,
      })
    )
    .filter((ev): ev is VatContractEvent => ev != null)
    .reverse();
}
