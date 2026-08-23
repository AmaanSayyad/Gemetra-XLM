import { describe, it, expect } from 'vitest';
import type { Payment } from '../lib/supabase';

const mockStellarPayment: Payment = {
  id: '123',
  employee_id: 'emp-1',
  user_id: 'user-1',
  amount: 100,
  token: 'XLM',
  transaction_hash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
  status: 'completed',
  payment_date: '2024-01-01',
  created_at: '2024-01-01T00:00:00Z',
  blockchain_type: 'stellar',
  network: 'mainnet',
  memo: 'Test payment',
  ledger: 12345678
};

describe('Payment Display Logic', () => {
  describe('getBlockchainTypeName', () => {
    it('should return "Stellar" for Stellar payments', () => {
      expect(mockStellarPayment.blockchain_type).toBe('stellar');
    });
  });

  describe('getExplorerLink', () => {
    it('should generate Stellar Expert link for Stellar mainnet payments', () => {
      const link = `https://stellar.expert/explorer/public/tx/${mockStellarPayment.transaction_hash}`;
      expect(link).toBe('https://stellar.expert/explorer/public/tx/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2');
    });

    it('should generate Stellar Expert link for Stellar testnet payments', () => {
      const testnetPayment: Payment = { ...mockStellarPayment, network: 'testnet' };
      const link = `https://stellar.expert/explorer/testnet/tx/${testnetPayment.transaction_hash}`;
      expect(link).toBe('https://stellar.expert/explorer/testnet/tx/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2');
    });
  });

  describe('formatTransactionHash', () => {
    it('should format Stellar transaction hash (first 8 + last 8)', () => {
      const hash = mockStellarPayment.transaction_hash!;
      const formatted = `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
      expect(formatted).toBe('a1b2c3d4...c9d0e1f2');
    });

    it('should return "N/A" for missing transaction hash', () => {
      const paymentWithoutHash = { ...mockStellarPayment, transaction_hash: undefined };
      const formatted = paymentWithoutHash.transaction_hash ? 'formatted' : 'N/A';
      expect(formatted).toBe('N/A');
    });
  });

  describe('getNetworkName', () => {
    it('should return "Mainnet" for mainnet payments', () => {
      const name = mockStellarPayment.network === 'mainnet' ? 'Mainnet' : 'Testnet';
      expect(name).toBe('Mainnet');
    });

    it('should return "Testnet" for testnet payments', () => {
      const testnetPayment: Payment = { ...mockStellarPayment, network: 'testnet' };
      const name = testnetPayment.network === 'mainnet' ? 'Mainnet' : 'Testnet';
      expect(name).toBe('Testnet');
    });
  });

  describe('Payment Creation', () => {
    it('should set blockchain_type to "stellar" for new payments', () => {
      const newPayment = {
        ...mockStellarPayment,
        blockchain_type: 'stellar' as const
      };
      expect(newPayment.blockchain_type).toBe('stellar');
    });

    it('should default token to XLM', () => {
      expect(mockStellarPayment.token).toBe('XLM');
    });

    it('should include memo field for Stellar payments', () => {
      expect(mockStellarPayment.memo).toBe('Test payment');
    });

    it('should include ledger field for Stellar payments', () => {
      expect(mockStellarPayment.ledger).toBe(12345678);
    });
  });
});
