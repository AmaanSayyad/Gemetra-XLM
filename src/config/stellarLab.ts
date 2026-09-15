import * as StellarSdk from '@stellar/stellar-sdk';

export const LAB_HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const LAB_RPC_URL = 'https://soroban-testnet.stellar.org';
export const LAB_PASSPHRASE = StellarSdk.Networks.TESTNET;
export const LAB_EXPLORER = 'https://stellar.expert/explorer/testnet';
export const LAB_FRIENDBOT = 'https://friendbot.stellar.org';

/** Testnet vat-refund (v3 with audit hook). Override with VITE_LAB_VAT_CONTRACT_ID. */
export const LAB_VAT_CONTRACT_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LAB_VAT_CONTRACT_ID?.trim()) ||
  'CCELCTUKPMS46CV6MVAFQY2FEJ354JU2FSZKAJ2P2WAHDNJIMCPJSI56';

/** Testnet claim-audit. Override with VITE_LAB_AUDIT_CONTRACT_ID. */
export const LAB_AUDIT_CONTRACT_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LAB_AUDIT_CONTRACT_ID?.trim()) ||
  'CBCDURJJSM6ZB2ISA34TBMYQQ7XGNMBLDPHL6XPZXJIL6D5AGLYHQIPI';

export function labTxUrl(hash: string): string {
  return `${LAB_EXPLORER}/tx/${hash}`;
}

export function labContractUrl(id: string): string {
  return `${LAB_EXPLORER}/contract/${id}`;
}

export function labAccountUrl(address: string): string {
  return `${LAB_EXPLORER}/account/${address}`;
}
