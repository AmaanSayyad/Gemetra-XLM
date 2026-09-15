import * as StellarSdk from '@stellar/stellar-sdk';
import {
  LAB_AUDIT_CONTRACT_ID,
  LAB_FRIENDBOT,
  LAB_HORIZON_URL,
  LAB_PASSPHRASE,
  LAB_RPC_URL,
  LAB_VAT_CONTRACT_ID,
} from '../config/stellarLab';
import { isValidStellarAddress } from '../utils/stellar';

export type LabErrorCode = 'WALLET_NOT_FOUND' | 'USER_REJECTED' | 'INSUFFICIENT_BALANCE' | 'UNKNOWN';

export interface ClassifiedLabError {
  code: LabErrorCode;
  message: string;
}

const horizon = () => new StellarSdk.Horizon.Server(LAB_HORIZON_URL);
const rpc = () => new StellarSdk.rpc.Server(LAB_RPC_URL);

export function classifyLabError(raw: string): ClassifiedLabError {
  const lower = (raw || '').toLowerCase();

  if (
    lower.includes('wallet not found') ||
    lower.includes('freighter') && lower.includes('install') ||
    lower.includes('not installed') ||
    lower.includes('no wallet connected')
  ) {
    return { code: 'WALLET_NOT_FOUND', message: raw };
  }

  if (
    lower.includes('rejected') ||
    lower.includes('declined') ||
    lower.includes('denied') ||
    lower.includes('user closed')
  ) {
    return { code: 'USER_REJECTED', message: raw };
  }

  if (
    lower.includes('insufficient') ||
    lower.includes('underfunded') ||
    lower.includes('op_underfunded') ||
    lower.includes('tx_insufficient_balance')
  ) {
    return { code: 'INSUFFICIENT_BALANCE', message: raw };
  }

  return { code: 'UNKNOWN', message: raw || 'Something went wrong.' };
}

export async function getTestnetXlmBalance(address: string): Promise<number> {
  if (!isValidStellarAddress(address)) {
    throw new Error('Invalid Stellar address');
  }
  try {
    const account = await horizon().loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === 'native');
    return native ? parseFloat(native.balance) : 0;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return 0;
    throw err;
  }
}

export async function fundTestnetAccount(address: string): Promise<void> {
  const res = await fetch(`${LAB_FRIENDBOT}/?addr=${encodeURIComponent(address)}`);
  if (!res.ok) {
    const text = await res.text();
    if (text.toLowerCase().includes('already funded') || res.status === 400) {
      return;
    }
    throw new Error(text || 'Friendbot funding failed');
  }
}

export async function sendTestnetXlm(params: {
  source: string;
  destination: string;
  amount: number;
  memo?: string;
  signTransaction: (xdr: string, network?: 'mainnet' | 'testnet') => Promise<string>;
}): Promise<{ txHash: string; ledger?: number }> {
  const { source, destination, amount, memo, signTransaction } = params;

  if (!isValidStellarAddress(destination)) {
    throw new Error('Invalid destination Stellar address');
  }
  if (!(amount > 0) || !Number.isFinite(amount)) {
    throw new Error('Amount must be greater than zero');
  }

  const balance = await getTestnetXlmBalance(source);
  const required = amount + 0.00001 + 1;
  if (balance < required) {
    throw new Error(
      `Insufficient XLM balance. Need ${required.toFixed(7)} XLM (amount + fee + 1 XLM reserve). Available: ${balance.toFixed(7)} XLM.`
    );
  }

  const account = await horizon().loadAccount(source);
  const builder = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: LAB_PASSPHRASE,
  }).addOperation(
    StellarSdk.Operation.payment({
      destination,
      asset: StellarSdk.Asset.native(),
      amount: amount.toFixed(7),
    })
  );

  if (memo?.trim()) {
    builder.addMemo(StellarSdk.Memo.text(memo.trim().slice(0, 28)));
  }

  const tx = builder.setTimeout(30).build();
  let signed: string;
  try {
    signed = await signTransaction(tx.toXDR(), 'testnet');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message || 'User rejected the transaction');
  }

  const signedTx = StellarSdk.TransactionBuilder.fromXDR(signed, LAB_PASSPHRASE);
  const result = await horizon().submitTransaction(signedTx);
  return { txHash: result.hash, ledger: result.ledger };
}

export type PaymentEvent = {
  id: string;
  type: string;
  amount?: string;
  from?: string;
  to?: string;
  createdAt?: string;
};

export function streamTestnetPayments(
  address: string,
  onEvent: (event: PaymentEvent) => void,
  onError?: (err: Error) => void
): () => void {
  const close = horizon()
    .payments()
    .forAccount(address)
    .cursor('now')
    .stream({
      onmessage: (msg: Record<string, unknown>) => {
        onEvent({
          id: String(msg.id ?? msg.paging_token ?? Date.now()),
          type: String(msg.type ?? 'payment'),
          amount: msg.amount != null ? String(msg.amount) : undefined,
          from: msg.from != null ? String(msg.from) : undefined,
          to: msg.to != null ? String(msg.to) : undefined,
          createdAt: msg.created_at != null ? String(msg.created_at) : undefined,
        });
      },
      onerror: (err: unknown) => {
        onError?.(err instanceof Error ? err : new Error('Horizon stream error'));
      },
    });

  return () => {
    try {
      close();
    } catch {
      /* ignore */
    }
  };
}

type SignFn = (xdr: string, network?: 'mainnet' | 'testnet') => Promise<string>;

async function labContractClient(publicKey: string, signTransaction: SignFn, contractId: string) {
  const { Client } = await import('@stellar/stellar-sdk/contract');
  return Client.from({
    contractId,
    rpcUrl: LAB_RPC_URL,
    networkPassphrase: LAB_PASSPHRASE,
    publicKey,
    signTransaction: async (xdr: string) => {
      const signedTxXdr = await signTransaction(xdr, 'testnet');
      return { signedTxXdr, signerAddress: publicKey };
    },
  });
}

export async function submitLabClaim(params: {
  claimant: string;
  amountStroops: bigint;
  countryCode: string;
  signTransaction: SignFn;
}): Promise<{ claimId: number; txHash?: string }> {
  const client = await labContractClient(
    params.claimant,
    params.signTransaction,
    LAB_VAT_CONTRACT_ID
  );
  const receipt = new Uint8Array(32);
  crypto.getRandomValues(receipt);

  const assembled = await client.submit_claim({
    claimant: params.claimant,
    amount: params.amountStroops,
    receipt_hash: receipt,
    country_code: params.countryCode,
  });
  const sent = await assembled.signAndSend();
  const claimId = typeof sent.result === 'bigint' ? Number(sent.result) : Number(sent.result);
  const txHash =
    (sent as { sendTransactionResponse?: { hash?: string } }).sendTransactionResponse?.hash;
  return { claimId, txHash };
}

export async function readLabClaim(params: {
  reader: string;
  claimId: number;
  signTransaction: SignFn;
}): Promise<{ status: number; amount: string; country: string } | null> {
  try {
    const client = await labContractClient(params.reader, params.signTransaction, LAB_VAT_CONTRACT_ID);
    const assembled = await client.get_claim({ claim_id: BigInt(params.claimId) });
    const sim = await assembled.simulate();
    const result = (sim as { result?: { retval?: unknown } }).result?.retval ?? assembled;
    const claim = (result as { result?: unknown }).result ?? result;
    const record = claim as {
      status?: { tag?: string; value?: number } | number;
      amount?: bigint | string;
      country_code?: string;
    };
    const status =
      typeof record.status === 'number'
        ? record.status
        : Number((record.status as { value?: number })?.value ?? 0);
    return {
      status,
      amount: String(record.amount ?? ''),
      country: String(record.country_code ?? ''),
    };
  } catch (err) {
    console.warn('get_claim failed:', err);
    return null;
  }
}

export async function readAuditCount(params: {
  reader: string;
  signTransaction: SignFn;
}): Promise<number | null> {
  if (!LAB_AUDIT_CONTRACT_ID) return null;
  try {
    const client = await labContractClient(params.reader, params.signTransaction, LAB_AUDIT_CONTRACT_ID);
    const assembled = await client.count();
    const sent = await assembled.simulate();
    const raw = (sent as { result?: { retval?: unknown } }).result?.retval ?? assembled.result;
    return typeof raw === 'bigint' ? Number(raw) : Number(raw ?? 0);
  } catch (err) {
    console.warn('audit count failed:', err);
    return null;
  }
}

export async function pollContractEvents(
  contractId: string,
  startLedger: number | undefined,
  onEvent: (topic: string) => void
): Promise<number | undefined> {
  try {
    const latest = await rpc().getLatestLedger();
    const from = startLedger ?? Math.max(1, latest.sequence - 200);
    const page = await rpc().getEvents({
      startLedger: from,
      filters: [{ type: 'contract', contractIds: [contractId] }],
      limit: 20,
    });
    for (const ev of page.events ?? []) {
      const topic = (ev as { topic?: unknown[] }).topic?.[0];
      onEvent(topic != null ? String(topic) : 'contract_event');
    }
    return latest.sequence;
  } catch (err) {
    console.warn('getEvents failed:', err);
    return startLedger;
  }
}
