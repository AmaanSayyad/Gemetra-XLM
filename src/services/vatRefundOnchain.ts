import { xlmToStroops } from '../utils/stellar';
import type { VATRefundDetails } from '../lib/supabase';
import { getCurrentNetwork, getStellarConfig } from '../config/stellar';

type SignTransactionFn = (xdr: string) => Promise<string>;

function envEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_VAT_REFUND_ONCHAIN === 'true';
}

function getContractId(): string | undefined {
  const v = import.meta.env.VITE_VAT_REFUND_CONTRACT_ID;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

function getSorobanRpcUrl(): string | undefined {
  const v = import.meta.env.VITE_SOROBAN_RPC_URL;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

function getNetworkPassphrase(): string {
  const network = getCurrentNetwork();
  return getStellarConfig(network).networkPassphrase;
}

function mustHaveCrypto(): boolean {
  // `crypto.subtle` exists in modern browsers; we keep on-chain integration best-effort.
  return typeof globalThis !== 'undefined' && !!globalThis.crypto?.subtle;
}

async function sha256Bytes32(input: string): Promise<Uint8Array | null> {
  try {
    if (!mustHaveCrypto()) return null;

    const enc = new TextEncoder();
    const digest = await globalThis.crypto.subtle.digest('SHA-256', enc.encode(input));
    const bytes = new Uint8Array(digest);
    if (bytes.length !== 32) return null;
    return bytes;
  } catch {
    return null;
  }
}

export function buildReceiptHashMaterial(details: VATRefundDetails, amountXlm: number): string {
  // Deterministic “app-defined digest” input.
  // (Contract only stores the hash; it doesn't re-derive or verify it.)
  const parts = [
    `amountXlm=${amountXlm}`,
    `countryCode=${details.claimCountryCode ?? ''}`,
    `vatRegNo=${details.vatRegNo ?? ''}`,
    `receiptNo=${details.receiptNo ?? ''}`,
    `billAmount=${details.billAmount ?? ''}`,
    `vatAmount=${details.vatAmount ?? ''}`,
    `passportNo=${details.passportNo ?? ''}`,
    `purchaseDate=${details.purchaseDate ?? ''}`,
    `merchantName=${details.merchantName ?? ''}`,
    `merchantAddress=${details.merchantAddress ?? ''}`,
    `receiverWalletAddress=${details.receiverWalletAddress ?? ''}`,
  ];

  return parts.join('|');
}

export async function computeReceiptHashBytes32(
  details: VATRefundDetails,
  amountXlm: number
): Promise<Uint8Array | null> {
  const material = buildReceiptHashMaterial(details, amountXlm);
  return sha256Bytes32(material);
}

async function computeHashBytes32FromString(input: string): Promise<Uint8Array | null> {
  return sha256Bytes32(input);
}

function isArgsBytesN32(bytes: Uint8Array | undefined | null): bytes is Uint8Array {
  return !!bytes && bytes.length === 32;
}

async function getClientOrNull(params: {
  contractId: string;
  rpcUrl: string;
  publicKey: string;
  signTransaction: SignTransactionFn;
}) {
  const { contractId, rpcUrl, publicKey, signTransaction } = params;
  try {
    // Lazy-load to avoid impacting the dApp when on-chain mode is disabled.
    const { Client } = await import('@stellar/stellar-sdk/contract');
    const client = await Client.from({
      contractId,
      rpcUrl,
      networkPassphrase: getNetworkPassphrase(),
      publicKey,
      signTransaction: async (xdr: string) => {
        const signedTxXdr = await signTransaction(xdr);
        return { signedTxXdr, signerAddress: publicKey };
      },
    });
    return client;
  } catch (err) {
    console.warn('Soroban client init failed (non-fatal):', err);
    return null;
  }
}

export async function submitClaimOnSorobanIfEnabled(params: {
  claimant: string;
  amountXlm: number;
  receiptHashBytes32: Uint8Array;
  countryCode: string;
  signTransaction: SignTransactionFn;
}): Promise<number | null> {
  if (!envEnabled()) return null;

  const contractId = getContractId();
  const rpcUrl = getSorobanRpcUrl();
  if (!contractId || !rpcUrl) return null;

  if (!isArgsBytesN32(params.receiptHashBytes32)) return null;

  try {
    const client = await getClientOrNull({
      contractId,
      rpcUrl,
      publicKey: params.claimant,
      signTransaction: params.signTransaction,
    });
    if (!client) return null;

    const stroopsStr = xlmToStroops(params.amountXlm);
    const amountI128 = BigInt(stroopsStr);

    const assembledTx = await client.submit_claim({
      claimant: params.claimant,
      amount: amountI128,
      receipt_hash: params.receiptHashBytes32,
      country_code: params.countryCode,
    });

    const sentTx = await assembledTx.signAndSend();
    // `u64` comes back as bigint.
    const claimId = sentTx.result;
    return typeof claimId === 'bigint' ? Number(claimId) : Number(claimId);
  } catch (err) {
    console.warn('submit_claim failed (non-fatal):', err);
    return null;
  }
}

export async function markPaidOnSorobanIfEnabled(params: {
  admin: string;
  claimId: number;
  payoutRefBytes32: Uint8Array;
  signTransaction: SignTransactionFn;
}): Promise<void> {
  if (!envEnabled()) return;

  const contractId = getContractId();
  const rpcUrl = getSorobanRpcUrl();
  if (!contractId || !rpcUrl) return;

  if (!isArgsBytesN32(params.payoutRefBytes32)) return;

  try {
    const client = await getClientOrNull({
      contractId,
      rpcUrl,
      publicKey: params.admin,
      signTransaction: params.signTransaction,
    });
    if (!client) return;

    await (await client.mark_paid({
      admin: params.admin,
      claim_id: BigInt(params.claimId),
      payout_ref: params.payoutRefBytes32,
    })).signAndSend();
  } catch (err) {
    console.warn('mark_paid failed (non-fatal):', err);
  }
}

export async function cancelClaimOnSorobanIfEnabled(params: {
  admin: string;
  claimId: number;
  signTransaction: SignTransactionFn;
}): Promise<void> {
  if (!envEnabled()) return;

  const contractId = getContractId();
  const rpcUrl = getSorobanRpcUrl();
  if (!contractId || !rpcUrl) return;

  try {
    const client = await getClientOrNull({
      contractId,
      rpcUrl,
      publicKey: params.admin,
      signTransaction: params.signTransaction,
    });
    if (!client) return;

    await (await client.cancel_claim({
      admin: params.admin,
      claim_id: BigInt(params.claimId),
    })).signAndSend();
  } catch (err) {
    console.warn('cancel_claim failed (non-fatal):', err);
  }
}

export async function blacklistClaimOnSorobanIfEnabled(params: {
  admin: string;
  claimId: number;
  signTransaction: SignTransactionFn;
}): Promise<void> {
  if (!envEnabled()) return;

  const contractId = getContractId();
  const rpcUrl = getSorobanRpcUrl();
  if (!contractId || !rpcUrl) return;

  try {
    const client = await getClientOrNull({
      contractId,
      rpcUrl,
      publicKey: params.admin,
      signTransaction: params.signTransaction,
    });
    if (!client) return;

    await (await client.blacklist_claim({
      admin: params.admin,
      claim_id: BigInt(params.claimId),
    })).signAndSend();
  } catch (err) {
    console.warn('blacklist_claim failed (non-fatal):', err);
  }
}

export async function computePayoutRefBytes32FromTxHash(
  txHash: string
): Promise<Uint8Array | null> {
  return computeHashBytes32FromString(txHash);
}

