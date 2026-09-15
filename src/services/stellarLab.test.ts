import { describe, expect, it } from 'vitest';
import { classifyLabError } from './stellarLab';

describe('classifyLabError', () => {
  it('maps wallet not found', () => {
    expect(classifyLabError('Wallet not found. Install Freighter').code).toBe('WALLET_NOT_FOUND');
    expect(classifyLabError('No wallet connected. Please connect a wallet first.').code).toBe(
      'WALLET_NOT_FOUND'
    );
  });

  it('maps user rejected', () => {
    expect(classifyLabError('Transaction signing rejected. Please approve the transaction.').code).toBe(
      'USER_REJECTED'
    );
    expect(classifyLabError('User declined the request').code).toBe('USER_REJECTED');
  });

  it('maps insufficient balance', () => {
    expect(classifyLabError('Insufficient XLM balance. You need at least 2 XLM').code).toBe(
      'INSUFFICIENT_BALANCE'
    );
    expect(classifyLabError('tx_insufficient_balance').code).toBe('INSUFFICIENT_BALANCE');
  });
});
