/**
 * Gemetra treasury and admin wallet configuration.
 * Treasury pays VAT refunds and points redemptions; admin unlocks the ops dashboard.
 */

const DEFAULT_TREASURY_KEY = 'GDHAGXZUWGJR6AQW25IU74J5JSU5HAKUMUY3SY4JNMJXNXEJCZM7WOAW';
const DEFAULT_ADMIN_KEY = 'GDHAGXZUWGJR6AQW25IU74J5JSU5HAKUMUY3SY4JNMJXNXEJCZM7WOAW';

/** Admin wallet — unlocks VAT Admin dashboard */
export const ADMIN_PUBLIC_KEY: string =
  import.meta.env.VITE_ADMIN_PUBLIC_KEY?.trim() || DEFAULT_ADMIN_KEY;

/** Treasury wallet — source of on-chain XLM refund payouts */
export const TREASURY_PUBLIC_KEY: string =
  import.meta.env.VITE_TREASURY_PUBLIC_KEY?.trim() || DEFAULT_TREASURY_KEY;

export function isAdminAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  return address.toLowerCase() === ADMIN_PUBLIC_KEY.toLowerCase();
}

export function getTreasuryExplorerAccountUrl(network?: 'mainnet' | 'testnet'): string {
  const net = network ?? (import.meta.env.VITE_STELLAR_NETWORK === 'mainnet' ? 'public' : 'testnet');
  return `https://stellar.expert/explorer/${net}/account/${TREASURY_PUBLIC_KEY}`;
}

export function formatStellarAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
