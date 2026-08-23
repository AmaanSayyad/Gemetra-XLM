/**
 * Stellar Utilities Module
 * 
 * Core utility functions for Stellar operations including address validation,
 * amount conversion, balance operations, and payment processing.
 * 
 * Requirements: 4.1, 6.1, 6.2, 6.3, 7.1, 7.2, 20.2
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { getHorizonServer, getStellarConfig, getCurrentNetwork } from '../config/stellar';

/**
 * Balance cache entry
 */
interface BalanceCacheEntry {
  balance: number;
  availableBalance: number;
  minimumReserve: number;
  timestamp: number;
}

/**
 * Balance cache with 10-second TTL
 * Maps address to balance cache entry
 */
const balanceCache: Map<string, BalanceCacheEntry> = new Map();

/**
 * Cache TTL in milliseconds (10 seconds)
 */
const BALANCE_CACHE_TTL = 10_000;

/**
 * Validate a Stellar address
 * 
 * Checks if the provided address is a valid Stellar public key (G-format)
 * or a valid federated address (name*domain.com format).
 * 
 * @param address - The address to validate
 * @returns true if the address is valid, false otherwise
 * 
 * Requirements: 4.1, 6.1, 6.2, 6.3
 */
export function isValidStellarAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Trim whitespace
  const trimmedAddress = address.trim();

  // Check for federated address format (name*domain.com)
  if (trimmedAddress.includes('*')) {
    // Basic federated address validation
    // Format: username*domain.com
    const parts = trimmedAddress.split('*');
    if (parts.length !== 2) {
      return false;
    }
    
    const [username, domain] = parts;
    
    // Username should not be empty and should contain valid characters
    if (!username || username.length === 0) {
      return false;
    }
    
    // Domain should be a valid domain format (basic check)
    // Supports subdomains like sub.domain.com
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domain || !domainRegex.test(domain)) {
      return false;
    }
    
    return true;
  }

  // Check for G-format Stellar address (56 characters starting with 'G')
  if (trimmedAddress.length !== 56) {
    return false;
  }

  if (!trimmedAddress.startsWith('G')) {
    return false;
  }

  // Use Stellar SDK to validate the address checksum
  try {
    StellarSdk.StrKey.decodeEd25519PublicKey(trimmedAddress);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Format a Stellar address for display
 * 
 * Shortens the address to show first 6 and last 4 characters
 * for better readability in UI components.
 * 
 * @param address - The Stellar address to format
 * @returns Formatted address (e.g., "GBRPYH...OX2H") or original if invalid
 * 
 * Requirements: 6.1
 */
export function formatStellarAddress(address: string): string {
  if (!address || typeof address !== 'string') {
    return '';
  }

  const trimmedAddress = address.trim();

  // For federated addresses, return as-is (they're already readable)
  if (trimmedAddress.includes('*')) {
    return trimmedAddress;
  }

  // For G-format addresses, show first 6 and last 4 characters
  if (trimmedAddress.length === 56 && trimmedAddress.startsWith('G')) {
    return `${trimmedAddress.substring(0, 6)}...${trimmedAddress.substring(52)}`;
  }

  // If address doesn't match expected format, return as-is
  return trimmedAddress;
}

/**
 * Get error message for invalid Stellar address
 * 
 * Provides clear, user-friendly error messages for different
 * types of address validation failures.
 * 
 * @param address - The address that failed validation
 * @returns Descriptive error message
 * 
 * Requirements: 6.3
 */
export function getAddressValidationError(address: string): string {
  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    return 'Address is required';
  }

  const trimmedAddress = address.trim();

  // Check for federated address
  if (trimmedAddress.includes('*')) {
    const parts = trimmedAddress.split('*');
    if (parts.length !== 2) {
      return 'Invalid federated address format. Expected format: username*domain.com';
    }
    
    const [username, domain] = parts;
    
    if (!username || username.length === 0) {
      return 'Federated address username cannot be empty';
    }
    
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domain || !domainRegex.test(domain)) {
      return 'Invalid domain in federated address';
    }
    
    return 'Invalid federated address format';
  }

  // Check G-format address
  if (trimmedAddress.length !== 56) {
    return `Stellar addresses must be exactly 56 characters (current: ${trimmedAddress.length})`;
  }

  if (!trimmedAddress.startsWith('G')) {
    return 'Stellar public addresses must start with "G"';
  }

  // If we get here, it's likely a checksum error
  try {
    StellarSdk.StrKey.decodeEd25519PublicKey(trimmedAddress);
    return 'Invalid Stellar address'; // Shouldn't reach here if validation passed
  } catch (error) {
    return 'Invalid Stellar address format (checksum verification failed)';
  }
}

/**
 * Convert XLM to stroops
 * 
 * Converts XLM amount to stroops (smallest unit of XLM).
 * 1 XLM = 10,000,000 stroops (7 decimal places precision).
 * 
 * @param xlm - The XLM amount to convert
 * @returns String representation of stroops amount
 * 
 * Requirements: 2.3
 */
export function xlmToStroops(xlm: number): string {
  if (typeof xlm !== 'number' || isNaN(xlm) || !isFinite(xlm)) {
    throw new Error('XLM amount must be a valid number');
  }

  if (xlm < 0) {
    throw new Error('XLM amount cannot be negative');
  }

  // 1 XLM = 10,000,000 stroops
  const STROOPS_PER_XLM = 10_000_000;
  
  // Multiply by stroops per XLM and round to avoid floating point issues
  const stroops = Math.round(xlm * STROOPS_PER_XLM);
  
  return stroops.toString();
}

/**
 * Convert stroops to XLM
 * 
 * Converts stroops (smallest unit) to XLM amount.
 * 1 XLM = 10,000,000 stroops (7 decimal places precision).
 * 
 * @param stroops - The stroops amount to convert (as string to preserve precision)
 * @returns XLM amount as number
 * 
 * Requirements: 2.3
 */
export function stroopsToXlm(stroops: string): number {
  if (typeof stroops !== 'string' || stroops.trim().length === 0) {
    throw new Error('Stroops amount must be a valid string');
  }

  const stroopsNum = parseInt(stroops, 10);
  
  if (isNaN(stroopsNum) || stroops.includes('.')) {
    throw new Error('Stroops amount must be a valid numeric string');
  }

  if (stroopsNum < 0) {
    throw new Error('Stroops amount cannot be negative');
  }

  // 1 XLM = 10,000,000 stroops
  const STROOPS_PER_XLM = 10_000_000;
  
  // Divide by stroops per XLM
  return stroopsNum / STROOPS_PER_XLM;
}

/**
 * Format XLM amount for display
 * 
 * Formats XLM amount with exactly 7 decimal places (Stellar's standard precision).
 * This ensures consistent display across the application.
 * 
 * @param amount - The XLM amount to format
 * @returns Formatted XLM amount string with 7 decimal places
 * 
 * Requirements: 2.2
 */
export function formatXlm(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    throw new Error('Amount must be a valid number');
  }

  if (amount < 0) {
    throw new Error('Amount cannot be negative');
  }

  // Format with exactly 7 decimal places (Stellar's precision)
  return amount.toFixed(7);
}

/**
 * Get XLM balance for a Stellar account
 * 
 * Queries the Horizon API for the account's native XLM balance.
 * Implements 10-second caching to reduce API calls.
 * Handles unfunded accounts by returning 0 balance.
 * 
 * @param address - The Stellar public address to query
 * @returns Promise resolving to XLM balance as number
 * 
 * Requirements: 7.1, 7.2, 20.2
 */
export async function getXlmBalance(address: string): Promise<number> {
  if (!isValidStellarAddress(address)) {
    throw new Error('Invalid Stellar address');
  }

  // Check cache first
  const cached = balanceCache.get(address);
  if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_TTL) {
    return cached.balance;
  }

  try {
    const server = getHorizonServer();
    const account = await server.loadAccount(address);
    
    // Find the native XLM balance
    const xlmBalance = account.balances.find(
      (balance) => balance.asset_type === 'native'
    );
    
    const balance = xlmBalance ? parseFloat(xlmBalance.balance) : 0;
    
    // Calculate minimum reserve (base reserve × 2 + number of subentries × base reserve)
    // Base reserve is currently 0.5 XLM, minimum account reserve is 1 XLM
    const BASE_RESERVE = 0.5;
    const subentryCount = account.subentry_count || 0;
    const minimumReserve = BASE_RESERVE * (2 + subentryCount);
    
    // Calculate available balance (total - minimum reserve)
    const availableBalance = Math.max(0, balance - minimumReserve);
    
    // Update cache
    balanceCache.set(address, {
      balance,
      availableBalance,
      minimumReserve,
      timestamp: Date.now(),
    });
    
    return balance;
  } catch (error: any) {
    // Handle unfunded account (404 error)
    if (error.response?.status === 404) {
      // Cache the zero balance for unfunded accounts
      balanceCache.set(address, {
        balance: 0,
        availableBalance: 0,
        minimumReserve: 1, // Minimum to fund an account
        timestamp: Date.now(),
      });
      return 0;
    }
    
    // Handle rate limiting (429 error)
    if (error.response?.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }
    
    // Handle network timeout
    if (error.code === 'ECONNABORTED') {
      throw new Error('Network timeout. Please check your connection.');
    }
    
    // For other errors, log and return 0 to avoid breaking UI
    console.error('Balance query error:', error);
    return 0;
  }
}

/**
 * Get detailed account balances
 * 
 * Returns comprehensive balance information including total XLM,
 * available XLM (after minimum reserve), and minimum reserve amount.
 * Implements 10-second caching to reduce API calls.
 * 
 * @param address - The Stellar public address to query
 * @returns Promise resolving to balance details object
 * 
 * Requirements: 7.1, 7.2, 20.2
 */
export async function getAccountBalances(address: string): Promise<{
  xlm: number;
  availableXlm: number;
  minimumReserve: number;
}> {
  if (!isValidStellarAddress(address)) {
    throw new Error('Invalid Stellar address');
  }

  // Check cache first
  const cached = balanceCache.get(address);
  if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_TTL) {
    return {
      xlm: cached.balance,
      availableXlm: cached.availableBalance,
      minimumReserve: cached.minimumReserve,
    };
  }

  try {
    const server = getHorizonServer();
    const account = await server.loadAccount(address);
    
    // Find the native XLM balance
    const xlmBalance = account.balances.find(
      (balance) => balance.asset_type === 'native'
    );
    
    const balance = xlmBalance ? parseFloat(xlmBalance.balance) : 0;
    
    // Calculate minimum reserve (base reserve × 2 + number of subentries × base reserve)
    // Base reserve is currently 0.5 XLM, minimum account reserve is 1 XLM
    const BASE_RESERVE = 0.5;
    const subentryCount = account.subentry_count || 0;
    const minimumReserve = BASE_RESERVE * (2 + subentryCount);
    
    // Calculate available balance (total - minimum reserve)
    const availableBalance = Math.max(0, balance - minimumReserve);
    
    // Update cache
    const cacheEntry: BalanceCacheEntry = {
      balance,
      availableBalance,
      minimumReserve,
      timestamp: Date.now(),
    };
    balanceCache.set(address, cacheEntry);
    
    return {
      xlm: balance,
      availableXlm: availableBalance,
      minimumReserve,
    };
  } catch (error: any) {
    // Handle unfunded account (404 error)
    if (error.response?.status === 404) {
      const result = {
        xlm: 0,
        availableXlm: 0,
        minimumReserve: 1, // Minimum to fund an account
      };
      
      // Cache the zero balance for unfunded accounts
      balanceCache.set(address, {
        balance: 0,
        availableBalance: 0,
        minimumReserve: 1,
        timestamp: Date.now(),
      });
      
      return result;
    }
    
    // Handle rate limiting (429 error)
    if (error.response?.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }
    
    // Handle network timeout
    if (error.code === 'ECONNABORTED') {
      throw new Error('Network timeout. Please check your connection.');
    }
    
    // For other errors, log and return zeros to avoid breaking UI
    console.error('Balance query error:', error);
    return {
      xlm: 0,
      availableXlm: 0,
      minimumReserve: 1,
    };
  }
}

/**
 * Clear balance cache for a specific address or all addresses
 * 
 * Useful for forcing a fresh balance query after a transaction.
 * 
 * @param address - Optional address to clear from cache. If not provided, clears entire cache.
 */
export function clearBalanceCache(address?: string): void {
  if (address) {
    balanceCache.delete(address);
  } else {
    balanceCache.clear();
  }
}

/**
 * Build a payment transaction
 * 
 * Creates a Stellar payment transaction using TransactionBuilder.
 * Includes source account, destination, amount in stroops, and optional memo.
 * Calculates and includes the base fee (100 stroops).
 * Sets transaction timeout to 30 seconds.
 * 
 * @param params - Payment transaction parameters
 * @param params.sourceAddress - The sender's Stellar public address
 * @param params.destinationAddress - The recipient's Stellar public address
 * @param params.amount - The amount to send in stroops (string for precision)
 * @param params.memo - Optional memo text to include with the transaction
 * @returns Promise resolving to the built Transaction object
 * 
 * Requirements: 4.2, 9.1, 9.2
 */
export async function buildPaymentTransaction(params: {
  sourceAddress: string;
  destinationAddress: string;
  amount: string; // in stroops
  memo?: string;
}): Promise<StellarSdk.Transaction> {
  const { sourceAddress, destinationAddress, amount, memo } = params;

  // Validate source address
  if (!isValidStellarAddress(sourceAddress)) {
    throw new Error('Invalid source address');
  }

  // Validate destination address
  if (!isValidStellarAddress(destinationAddress)) {
    throw new Error('Invalid destination address');
  }

  // Validate amount
  if (!amount || typeof amount !== 'string') {
    throw new Error('Amount must be provided as a string');
  }

  const amountNum = parseInt(amount, 10);
  if (isNaN(amountNum) || amountNum <= 0) {
    throw new Error('Amount must be a positive number');
  }

  // Validate memo if provided
  if (memo !== undefined && typeof memo !== 'string') {
    throw new Error('Memo must be a string');
  }

  try {
    // Get Horizon server and network config
    const server = getHorizonServer();
    const config = getStellarConfig(getCurrentNetwork());

    // Load source account to get sequence number
    const sourceAccount = await server.loadAccount(sourceAddress);

    // Convert stroops to XLM for the payment operation
    const xlmAmount = stroopsToXlm(amount);

    // Build the transaction
    const transactionBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE, // 100 stroops
      networkPassphrase: config.networkPassphrase,
    });

    // Add payment operation
    transactionBuilder.addOperation(
      StellarSdk.Operation.payment({
        destination: destinationAddress,
        asset: StellarSdk.Asset.native(), // XLM
        amount: xlmAmount.toString(),
      })
    );

    // Add memo if provided
    if (memo && memo.trim().length > 0) {
      transactionBuilder.addMemo(StellarSdk.Memo.text(memo.trim()));
    }

    // Set timeout to 30 seconds
    transactionBuilder.setTimeout(30);

    // Build and return the transaction
    const transaction = transactionBuilder.build();

    return transaction;
  } catch (error: any) {
    // Handle account not found error
    if (error.response?.status === 404) {
      throw new Error('Source account not found on Stellar network');
    }

    // Handle network errors
    if (error.code === 'ECONNABORTED') {
      throw new Error('Network timeout. Please check your connection.');
    }

    // Re-throw validation errors
    if (error.message.includes('Invalid') || error.message.includes('Amount')) {
      throw error;
    }

    // Generic error
    throw new Error(`Failed to build payment transaction: ${error.message}`);
  }
}

/**
 * Submit a signed transaction to the Stellar network
 * 
 * Submits a signed transaction XDR to the Horizon API.
 * Returns transaction hash, ledger number, and success status.
 * Handles transaction errors with descriptive, user-friendly messages.
 * Maps Stellar error codes to clear error messages.
 * 
 * @param transaction - The built Transaction object
 * @param signedXdr - The signed transaction XDR string
 * @returns Promise resolving to transaction result with hash, ledger, and success status
 * 
 * Requirements: 4.4, 4.5, 4.6
 */
export async function submitTransaction(
  transaction: StellarSdk.Transaction,
  signedXdr: string
): Promise<{
  hash: string;
  ledger: number;
  success: boolean;
}> {
  // Validate inputs
  if (!transaction) {
    throw new Error('Transaction is required');
  }

  if (!signedXdr || typeof signedXdr !== 'string') {
    throw new Error('Signed XDR is required');
  }

  try {
    // Get Horizon server
    const server = getHorizonServer();

    // Parse the signed transaction from XDR
    const signedTransaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      getStellarConfig(getCurrentNetwork()).networkPassphrase
    ) as StellarSdk.Transaction;

    // Submit the transaction to the network
    const response = await server.submitTransaction(signedTransaction);

    // Return success result
    return {
      hash: response.hash,
      ledger: response.ledger,
      success: true,
    };
  } catch (error: any) {
    // Handle Horizon API errors with descriptive messages
    if (error.response?.status === 400) {
      const resultCodes = error.response.data?.extras?.result_codes;

      if (resultCodes) {
        // Transaction-level errors
        if (resultCodes.transaction === 'tx_insufficient_balance') {
          throw new Error(
            'Insufficient XLM balance. Please ensure you have enough XLM to cover the payment amount and network fees (0.00001 XLM).'
          );
        }

        if (resultCodes.transaction === 'tx_no_source_account') {
          throw new Error('Source account not found on Stellar network.');
        }

        if (resultCodes.transaction === 'tx_bad_seq') {
          throw new Error(
            'Transaction sequence number is invalid. Please try again.'
          );
        }

        if (resultCodes.transaction === 'tx_bad_auth') {
          throw new Error('Transaction signature is invalid.');
        }

        if (resultCodes.transaction === 'tx_insufficient_fee') {
          throw new Error('Transaction fee is too low.');
        }

        if (resultCodes.transaction === 'tx_failed') {
          // Operation-level errors
          const operations = resultCodes.operations || [];

          if (operations.includes('op_no_destination')) {
            throw new Error(
              'Recipient account does not exist on Stellar network. The recipient must create an account first.'
            );
          }

          if (operations.includes('op_underfunded')) {
            throw new Error(
              'Insufficient XLM balance to complete this payment.'
            );
          }

          if (operations.includes('op_line_full')) {
            throw new Error('Recipient account cannot receive more of this asset.');
          }

          if (operations.includes('op_no_trust')) {
            throw new Error('Recipient does not trust this asset.');
          }

          if (operations.includes('op_malformed')) {
            throw new Error('Payment operation is malformed. Please check the payment details.');
          }

          // Generic operation failure
          throw new Error(
            `Transaction failed: ${operations.join(', ') || 'Unknown operation error'}`
          );
        }

        // Generic transaction error
        throw new Error(
          `Transaction failed: ${resultCodes.transaction || 'Unknown error'}`
        );
      }

      // No result codes available
      throw new Error('Transaction failed with bad request (400).');
    }

    // Handle timeout errors
    if (error.response?.status === 504 || error.code === 'ECONNABORTED') {
      throw new Error(
        'Transaction timeout. The network may be congested. Please try again.'
      );
    }

    // Handle rate limiting
    if (error.response?.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }

    // Handle network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(
        'Network connection error. Please check your internet connection.'
      );
    }

    // Handle XDR parsing errors
    if (error.message?.includes('XDR')) {
      throw new Error('Invalid transaction format. Please try again.');
    }

    // Generic error with original message
    throw new Error(
      `Transaction submission failed: ${error.message || 'Unknown error'}`
    );
  }
}

/**
 * Wallet signer interface for transaction signing
 * This interface should be implemented by the wallet manager (task 9)
 */
export interface WalletSigner {
  /**
   * Sign a transaction XDR with the connected wallet
   * @param xdr - The transaction XDR to sign
   * @returns Promise resolving to signed XDR string
   */
  signTransaction(xdr: string): Promise<string>;
  
  /**
   * Get the connected wallet's public key
   * @returns The public key or null if not connected
   */
  getPublicKey(): string | null;
  
  /**
   * Check if a wallet is connected
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean;
}

/**
 * Send an XLM payment
 * 
 * High-level wrapper function that combines building, signing, and submitting
 * a payment transaction. Handles wallet signing via the provided wallet signer.
 * Returns transaction hash and success status with comprehensive error handling.
 * 
 * @param params - Payment parameters
 * @param params.recipientAddress - The recipient's Stellar public address
 * @param params.amount - The amount to send in XLM (will be converted to stroops)
 * @param params.memo - Optional memo text to include with the transaction
 * @param walletSigner - Wallet signer instance for signing the transaction
 * @returns Promise resolving to payment result with transaction hash and success status
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export async function sendXlmPayment(
  params: {
    recipientAddress: string;
    amount: number;
    memo?: string;
  },
  walletSigner: WalletSigner
): Promise<{
  txHash: string;
  ledger?: number;
  success: boolean;
  error?: string;
}> {
  const { recipientAddress, amount, memo } = params;

  try {
    // Validate wallet connection
    if (!walletSigner.isConnected()) {
      return {
        txHash: '',
        success: false,
        error: 'Wallet not connected. Please connect your wallet first.',
      };
    }

    // Get source address from wallet
    const sourceAddress = walletSigner.getPublicKey();
    if (!sourceAddress) {
      return {
        txHash: '',
        success: false,
        error: 'Unable to get wallet address. Please reconnect your wallet.',
      };
    }

    // Validate recipient address
    if (!isValidStellarAddress(recipientAddress)) {
      return {
        txHash: '',
        success: false,
        error: getAddressValidationError(recipientAddress),
      };
    }

    // Validate amount
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
      return {
        txHash: '',
        success: false,
        error: 'Invalid amount. Please enter a valid number.',
      };
    }

    if (amount <= 0) {
      return {
        txHash: '',
        success: false,
        error: 'Amount must be greater than zero.',
      };
    }

    // Check if sender has sufficient balance
    try {
      const balances = await getAccountBalances(sourceAddress);
      const totalRequired = amount + 0.00001; // Amount + network fee

      if (balances.availableXlm < totalRequired) {
        return {
          txHash: '',
          success: false,
          error: `Insufficient XLM balance. You need at least ${formatXlm(totalRequired)} XLM (${formatXlm(amount)} for payment + 0.0000100 for network fee). Available: ${formatXlm(balances.availableXlm)} XLM.`,
        };
      }
    } catch (balanceError: any) {
      // If balance check fails, log but continue (let the network reject if insufficient)
      console.warn('Balance check failed:', balanceError.message);
    }

    // Convert amount to stroops
    const amountInStroops = xlmToStroops(amount);

    // Build the payment transaction
    const transaction = await buildPaymentTransaction({
      sourceAddress,
      destinationAddress: recipientAddress,
      amount: amountInStroops,
      memo,
    });

    // Get transaction XDR for signing
    const transactionXdr = transaction.toXDR();

    // Sign the transaction with the wallet
    let signedXdr: string;
    try {
      signedXdr = await walletSigner.signTransaction(transactionXdr);
    } catch (signError: any) {
      return {
        txHash: '',
        success: false,
        error: `Transaction signing failed: ${signError.message || 'User rejected the transaction'}`,
      };
    }

    // Submit the signed transaction to the network
    const result = await submitTransaction(transaction, signedXdr);

    // Clear balance cache for both sender and recipient to force refresh
    clearBalanceCache(sourceAddress);
    clearBalanceCache(recipientAddress);

    // Return success result
    return {
      txHash: result.hash,
      ledger: result.ledger,
      success: true,
    };
  } catch (error: any) {
    // Return error result with descriptive message
    return {
      txHash: '',
      success: false,
      error: error.message || 'Payment failed. Please try again.',
    };
  }
}

/**
 * Delay helper for rate limiting
 * 
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send bulk XLM payments
 * 
 * Processes multiple payment transactions sequentially to avoid sequence number conflicts.
 * Implements rate limiting (max 10 transactions per second) to prevent API throttling.
 * Continues processing remaining payments even if individual payments fail.
 * Returns an array of transaction hashes mapped to recipient addresses.
 * 
 * @param params - Bulk payment parameters
 * @param params.recipients - Array of recipient payment details
 * @param walletSigner - Wallet signer instance for signing transactions
 * @returns Promise resolving to bulk payment result with transaction hashes and status
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 20.3
 */
export async function sendBulkXlmPayments(
  params: {
    recipients: Array<{
      address: string;
      amount: number;
      memo?: string;
    }>;
  },
  walletSigner: WalletSigner
): Promise<{
  txHashes: Array<{
    address: string;
    txHash: string;
    ledger?: number;
    success: boolean;
    error?: string;
  }>;
  success: boolean;
  processed: number;
  failed: number;
  error?: string;
}> {
  const { recipients } = params;

  // Validate inputs
  if (!recipients || !Array.isArray(recipients)) {
    return {
      txHashes: [],
      success: false,
      processed: 0,
      failed: 0,
      error: 'Recipients must be provided as an array',
    };
  }

  if (recipients.length === 0) {
    return {
      txHashes: [],
      success: false,
      processed: 0,
      failed: 0,
      error: 'At least one recipient is required',
    };
  }

  // Validate wallet connection
  if (!walletSigner.isConnected()) {
    return {
      txHashes: [],
      success: false,
      processed: 0,
      failed: 0,
      error: 'Wallet not connected. Please connect your wallet first.',
    };
  }

  // Get source address from wallet
  const sourceAddress = walletSigner.getPublicKey();
  if (!sourceAddress) {
    return {
      txHashes: [],
      success: false,
      processed: 0,
      failed: 0,
      error: 'Unable to get wallet address. Please reconnect your wallet.',
    };
  }

  // Validate all recipients before processing
  const validationErrors: string[] = [];
  recipients.forEach((recipient, index) => {
    if (!isValidStellarAddress(recipient.address)) {
      validationErrors.push(
        `Recipient ${index + 1}: ${getAddressValidationError(recipient.address)}`
      );
    }

    if (
      typeof recipient.amount !== 'number' ||
      isNaN(recipient.amount) ||
      !isFinite(recipient.amount) ||
      recipient.amount <= 0
    ) {
      validationErrors.push(
        `Recipient ${index + 1}: Invalid amount (${recipient.amount})`
      );
    }
  });

  if (validationErrors.length > 0) {
    return {
      txHashes: [],
      success: false,
      processed: 0,
      failed: 0,
      error: `Validation errors:\n${validationErrors.join('\n')}`,
    };
  }

  // Check if sender has sufficient balance for all payments
  try {
    const balances = await getAccountBalances(sourceAddress);
    const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0);
    const totalFees = recipients.length * 0.00001; // 100 stroops per transaction
    const totalRequired = totalAmount + totalFees;

    if (balances.availableXlm < totalRequired) {
      return {
        txHashes: [],
        success: false,
        processed: 0,
        failed: 0,
        error: `Insufficient XLM balance. You need at least ${formatXlm(totalRequired)} XLM (${formatXlm(totalAmount)} for payments + ${formatXlm(totalFees)} for network fees). Available: ${formatXlm(balances.availableXlm)} XLM.`,
      };
    }
  } catch (balanceError: any) {
    // If balance check fails, log but continue (let the network reject if insufficient)
    console.warn('Balance check failed:', balanceError.message);
  }

  // Process payments sequentially with rate limiting
  const results: Array<{
    address: string;
    txHash: string;
    ledger?: number;
    success: boolean;
    error?: string;
  }> = [];

  let processedCount = 0;
  let failedCount = 0;

  // Rate limiting: max 10 transactions per second = 100ms between transactions
  const RATE_LIMIT_DELAY_MS = 100;

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];

    try {
      console.log(`💸 Processing payment ${i + 1}/${recipients.length}:`, {
        address: recipient.address,
        amount: recipient.amount,
        memo: recipient.memo
      });

      // Send individual payment with explicit amount
      const paymentResult = await sendXlmPayment(
        {
          recipientAddress: recipient.address,
          amount: recipient.amount, // Ensure we're using the correct amount for each recipient
          memo: recipient.memo,
        },
        walletSigner
      );

      if (paymentResult.success) {
        console.log(`✅ Payment ${i + 1} successful:`, paymentResult.txHash);
        results.push({
          address: recipient.address,
          txHash: paymentResult.txHash,
          ledger: paymentResult.ledger,
          success: true,
        });
        processedCount++;
      } else {
        console.error(`❌ Payment ${i + 1} failed:`, paymentResult.error);
        results.push({
          address: recipient.address,
          txHash: '',
          success: false,
          error: paymentResult.error || 'Payment failed',
        });
        failedCount++;
      }
    } catch (error: any) {
      console.error(`❌ Payment ${i + 1} exception:`, error);
      // Continue processing even if one payment fails
      results.push({
        address: recipient.address,
        txHash: '',
        success: false,
        error: error.message || 'Payment failed',
      });
      failedCount++;
    }

    // Apply rate limiting delay between transactions (except after the last one)
    if (i < recipients.length - 1) {
      await delay(RATE_LIMIT_DELAY_MS);
    }
  }

  // Clear balance cache for sender to force refresh
  clearBalanceCache(sourceAddress);

  // Determine overall success (at least one payment succeeded)
  const overallSuccess = processedCount > 0;

  return {
    txHashes: results,
    success: overallSuccess,
    processed: processedCount,
    failed: failedCount,
    error:
      failedCount > 0
        ? `${failedCount} of ${recipients.length} payments failed. See individual results for details.`
        : undefined,
  };
}

/**
 * Transaction history entry
 * Represents a payment operation from the Stellar network
 */
export interface TransactionHistoryEntry {
  hash: string;
  amount: string;
  recipient: string;
  sender: string;
  timestamp: string;
  status: 'completed' | 'failed';
  memo?: string;
  ledger: number;
  assetType: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  assetCode?: string;
  assetIssuer?: string;
}

/**
 * Get transaction history for a Stellar account
 * 
 * Queries the Horizon API for all payment operations associated with an account.
 * Returns payment operation data including hash, amount, recipient, timestamp, and status.
 * Sorts results by timestamp descending (most recent first).
 * Handles pagination for large transaction histories.
 * 
 * @param address - The Stellar public address to query
 * @param options - Optional query parameters
 * @param options.limit - Maximum number of records to return (default: 50, max: 200)
 * @param options.cursor - Pagination cursor for fetching next page
 * @returns Promise resolving to transaction history entries and pagination info
 * 
 * Requirements: 8.1, 8.2
 */
export async function getTransactionHistory(
  address: string,
  options?: {
    limit?: number;
    cursor?: string;
  }
): Promise<{
  records: TransactionHistoryEntry[];
  hasMore: boolean;
  nextCursor?: string;
}> {
  // Validate address
  if (!isValidStellarAddress(address)) {
    throw new Error('Invalid Stellar address');
  }

  // Validate and set default options
  const limit = options?.limit && options.limit > 0 && options.limit <= 200 
    ? options.limit 
    : 50;
  const cursor = options?.cursor;

  try {
    const server = getHorizonServer();

    // Build the payments query for this account
    let paymentsQuery = server
      .payments()
      .forAccount(address)
      .order('desc') // Most recent first
      .limit(limit);

    // Add cursor if provided for pagination
    if (cursor) {
      paymentsQuery = paymentsQuery.cursor(cursor);
    }

    // Execute the query
    const paymentsResponse = await paymentsQuery.call();

    // Parse payment operations into transaction history entries
    const records: TransactionHistoryEntry[] = [];

    for (const payment of paymentsResponse.records) {
      // Only process payment operations (type 1)
      if (payment.type !== 'payment') {
        continue;
      }

      // Type assertion for payment operation
      const paymentOp = payment as any;

      // Determine if this account is the sender or recipient
      const isSender = paymentOp.from === address;
      const recipient = paymentOp.to;
      const sender = paymentOp.from;

      // Parse asset information
      let assetType: 'native' | 'credit_alphanum4' | 'credit_alphanum12' = 'native';
      let assetCode: string | undefined;
      let assetIssuer: string | undefined;

      if (paymentOp.asset_type === 'native') {
        assetType = 'native';
      } else if (paymentOp.asset_type === 'credit_alphanum4') {
        assetType = 'credit_alphanum4';
        assetCode = paymentOp.asset_code;
        assetIssuer = paymentOp.asset_issuer;
      } else if (paymentOp.asset_type === 'credit_alphanum12') {
        assetType = 'credit_alphanum12';
        assetCode = paymentOp.asset_code;
        assetIssuer = paymentOp.asset_issuer;
      }

      // Get transaction details to check status
      // Note: Payment operations in the response are already successful
      // Failed transactions don't appear in the ledger
      const status: 'completed' | 'failed' = 'completed';

      // Create transaction history entry
      const entry: TransactionHistoryEntry = {
        hash: paymentOp.transaction_hash,
        amount: paymentOp.amount,
        recipient,
        sender,
        timestamp: paymentOp.created_at,
        status,
        memo: undefined, // Memo is on the transaction, not the operation
        ledger: paymentOp.ledger_attr || 0,
        assetType,
        assetCode,
        assetIssuer,
      };

      records.push(entry);
    }

    // Check if there are more records
    const hasMore = paymentsResponse.records.length === limit;
    const nextCursor = hasMore && paymentsResponse.records.length > 0
      ? paymentsResponse.records[paymentsResponse.records.length - 1].paging_token
      : undefined;

    return {
      records,
      hasMore,
      nextCursor,
    };
  } catch (error: any) {
    // Handle account not found error
    if (error.response?.status === 404) {
      // Account doesn't exist or has no payment history
      return {
        records: [],
        hasMore: false,
      };
    }

    // Handle rate limiting
    if (error.response?.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }

    // Handle network timeout
    if (error.code === 'ECONNABORTED') {
      throw new Error('Network timeout. Please check your connection.');
    }

    // Generic error
    throw new Error(
      `Failed to fetch transaction history: ${error.message || 'Unknown error'}`
    );
  }
}

/**
 * Get detailed transaction information including memo
 * 
 * Fetches full transaction details from Horizon API to get memo and other metadata.
 * This is useful when you need more information than what's available in the payment operation.
 * 
 * @param transactionHash - The transaction hash to query
 * @returns Promise resolving to transaction details
 * 
 * Requirements: 8.1, 8.2
 */
export async function getTransactionDetails(
  transactionHash: string
): Promise<{
  hash: string;
  ledger: number;
  createdAt: string;
  sourceAccount: string;
  memo?: string;
  memoType?: string;
  successful: boolean;
  operationCount: number;
}> {
  if (!transactionHash || typeof transactionHash !== 'string') {
    throw new Error('Transaction hash is required');
  }

  try {
    const server = getHorizonServer();

    // Fetch transaction details
    const transaction = await server.transactions().transaction(transactionHash).call();

    // Parse memo if present
    let memo: string | undefined;
    let memoType: string | undefined;

    if (transaction.memo_type && transaction.memo_type !== 'none') {
      memoType = transaction.memo_type;
      
      if (transaction.memo_type === 'text') {
        memo = transaction.memo;
      } else if (transaction.memo_type === 'id') {
        memo = `ID: ${transaction.memo}`;
      } else if (transaction.memo_type === 'hash') {
        memo = `Hash: ${transaction.memo}`;
      } else if (transaction.memo_type === 'return') {
        memo = `Return: ${transaction.memo}`;
      }
    }

    return {
      hash: transaction.hash,
      ledger: transaction.ledger_attr,
      createdAt: transaction.created_at,
      sourceAccount: transaction.source_account,
      memo,
      memoType,
      successful: transaction.successful,
      operationCount: transaction.operation_count,
    };
  } catch (error: any) {
    // Handle transaction not found
    if (error.response?.status === 404) {
      throw new Error('Transaction not found');
    }

    // Handle rate limiting
    if (error.response?.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }

    // Handle network timeout
    if (error.code === 'ECONNABORTED') {
      throw new Error('Network timeout. Please check your connection.');
    }

    // Generic error
    throw new Error(
      `Failed to fetch transaction details: ${error.message || 'Unknown error'}`
    );
  }
}

/**
 * Build a Stellar Expert transaction URL for the given network.
 */
export function getStellarExpertTxUrl(
  transactionHash: string,
  network: 'mainnet' | 'testnet' = getCurrentNetwork()
): string {
  const explorerNetwork = network === 'testnet' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${explorerNetwork}/tx/${transactionHash}`;
}
