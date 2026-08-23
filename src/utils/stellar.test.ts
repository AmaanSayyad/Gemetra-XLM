/**
 * Unit tests for Stellar Utilities Module
 * 
 * Tests Requirements: 4.1, 6.1, 6.2, 6.3, 7.1, 7.2, 20.2
 */

import { describe, it, expect } from 'vitest';
import {
  isValidStellarAddress,
  formatStellarAddress,
  getAddressValidationError,
  xlmToStroops,
  stroopsToXlm,
  formatXlm,
  getXlmBalance,
  getAccountBalances,
  buildPaymentTransaction,
  submitTransaction,
  sendXlmPayment,
  sendBulkXlmPayments,
} from './stellar';

describe('Stellar Utilities Module', () => {
  describe('isValidStellarAddress', () => {
    describe('Valid G-format addresses', () => {
      it('should accept valid Stellar public key addresses', () => {
        // These are real valid Stellar addresses
        const validAddresses = [
          'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          'GC3C4AKRBQLHOJ45U4XG35ESVWRDECWO5XLDGYADO6DPR3L7KIDVUMML',
        ];

        validAddresses.forEach(address => {
          expect(isValidStellarAddress(address)).toBe(true);
        });
      });

      it('should accept addresses with leading/trailing whitespace', () => {
        const address = '  GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H  ';
        expect(isValidStellarAddress(address)).toBe(true);
      });
    });

    describe('Valid federated addresses', () => {
      it('should accept valid federated addresses', () => {
        const federatedAddresses = [
          'alice*example.com',
          'bob*stellar.org',
          'user123*domain.io',
          'test.user*sub.domain.com',
        ];

        federatedAddresses.forEach(address => {
          expect(isValidStellarAddress(address)).toBe(true);
        });
      });
    });

    describe('Invalid addresses', () => {
      it('should reject addresses with wrong length', () => {
        const shortAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2';
        const longAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2HX';
        
        expect(isValidStellarAddress(shortAddress)).toBe(false);
        expect(isValidStellarAddress(longAddress)).toBe(false);
      });

      it('should reject addresses with wrong prefix', () => {
        // S-prefix is for secret keys, not public keys
        const secretKeyFormat = 'SBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
        expect(isValidStellarAddress(secretKeyFormat)).toBe(false);
      });

      it('should reject addresses with invalid checksum', () => {
        // Valid length and prefix, but invalid checksum
        const invalidChecksum = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OXXX';
        expect(isValidStellarAddress(invalidChecksum)).toBe(false);
      });

      it('should reject empty or null addresses', () => {
        expect(isValidStellarAddress('')).toBe(false);
        expect(isValidStellarAddress('   ')).toBe(false);
        expect(isValidStellarAddress(null as any)).toBe(false);
        expect(isValidStellarAddress(undefined as any)).toBe(false);
      });

      it('should reject non-string inputs', () => {
        expect(isValidStellarAddress(123 as any)).toBe(false);
        expect(isValidStellarAddress({} as any)).toBe(false);
        expect(isValidStellarAddress([] as any)).toBe(false);
      });

      it('should reject invalid federated addresses', () => {
        const invalidFederated = [
          '*example.com',           // Missing username
          'user*',                  // Missing domain
          'user**example.com',      // Multiple asterisks
          'user@example.com',       // Wrong separator
          'user*invalid',           // Invalid domain
          'user*.com',              // Missing domain name
        ];

        invalidFederated.forEach(address => {
          expect(isValidStellarAddress(address)).toBe(false);
        });
      });
    });
  });

  describe('formatStellarAddress', () => {
    it('should format G-format addresses correctly', () => {
      const address = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      const formatted = formatStellarAddress(address);
      
      expect(formatted).toBe('GBRPYH...OX2H');
      expect(formatted.length).toBe(13); // 6 + 3 dots + 4
    });

    it('should return federated addresses as-is', () => {
      const federatedAddress = 'alice*example.com';
      const formatted = formatStellarAddress(federatedAddress);
      
      expect(formatted).toBe(federatedAddress);
    });

    it('should handle addresses with whitespace', () => {
      const address = '  GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H  ';
      const formatted = formatStellarAddress(address);
      
      expect(formatted).toBe('GBRPYH...OX2H');
    });

    it('should return empty string for invalid inputs', () => {
      expect(formatStellarAddress('')).toBe('');
      expect(formatStellarAddress(null as any)).toBe('');
      expect(formatStellarAddress(undefined as any)).toBe('');
    });

    it('should return original string for non-standard formats', () => {
      const shortAddress = 'GBRPYH';
      expect(formatStellarAddress(shortAddress)).toBe(shortAddress);
    });
  });

  describe('getAddressValidationError', () => {
    it('should return error for empty address', () => {
      const error = getAddressValidationError('');
      expect(error).toContain('required');
    });

    it('should return error for wrong length', () => {
      const shortAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2';
      const error = getAddressValidationError(shortAddress);
      
      expect(error).toContain('56 characters');
      expect(error).toContain('55'); // Current length
    });

    it('should return error for wrong prefix', () => {
      const wrongPrefix = 'SBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      const error = getAddressValidationError(wrongPrefix);
      
      expect(error).toContain('start with "G"');
    });

    it('should return error for invalid checksum', () => {
      const invalidChecksum = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OXXX';
      const error = getAddressValidationError(invalidChecksum);
      
      expect(error).toContain('checksum');
    });

    it('should return error for invalid federated address format', () => {
      const invalidFederated = '*example.com';
      const error = getAddressValidationError(invalidFederated);
      
      expect(error).toContain('username');
    });

    it('should return error for invalid domain in federated address', () => {
      const invalidDomain = 'user*invalid';
      const error = getAddressValidationError(invalidDomain);
      
      expect(error).toContain('domain');
    });
  });

  describe('Edge cases', () => {
    it('should handle mixed case addresses', () => {
      // Stellar addresses are case-sensitive and should be uppercase
      const mixedCase = 'gbrpyhil2ci3fnq4bxlfmndlfjunpu2hy3zmfshonuceoasw7qc7ox2h';
      expect(isValidStellarAddress(mixedCase)).toBe(false);
    });

    it('should handle addresses with special characters', () => {
      const withSpecialChars = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H!';
      expect(isValidStellarAddress(withSpecialChars)).toBe(false);
    });

    it('should handle very long strings', () => {
      const veryLong = 'G'.repeat(100);
      expect(isValidStellarAddress(veryLong)).toBe(false);
    });
  });
});

describe('XLM-Stroops Conversion', () => {
  describe('xlmToStroops', () => {
    it('should convert 1 XLM to 10,000,000 stroops', () => {
      expect(xlmToStroops(1)).toBe('10000000');
    });

    it('should convert 0 XLM to 0 stroops', () => {
      expect(xlmToStroops(0)).toBe('0');
    });

    it('should convert very small XLM amounts correctly', () => {
      expect(xlmToStroops(0.0000001)).toBe('1'); // Smallest unit
      expect(xlmToStroops(0.0000010)).toBe('10');
      expect(xlmToStroops(0.0000100)).toBe('100');
    });

    it('should convert decimal XLM amounts correctly', () => {
      expect(xlmToStroops(100.5)).toBe('1005000000');
      expect(xlmToStroops(0.5)).toBe('5000000');
      expect(xlmToStroops(123.4567890)).toBe('1234567890');
    });

    it('should convert very large XLM amounts correctly', () => {
      expect(xlmToStroops(1000000)).toBe('10000000000000');
      expect(xlmToStroops(999999.9999999)).toBe('9999999999999');
    });

    it('should handle floating point precision correctly', () => {
      // Test that we round properly to avoid floating point issues
      expect(xlmToStroops(0.1234567)).toBe('1234567');
      expect(xlmToStroops(0.12345678)).toBe('1234568'); // Rounds up
    });

    it('should throw error for negative amounts', () => {
      expect(() => xlmToStroops(-1)).toThrow('cannot be negative');
      expect(() => xlmToStroops(-0.5)).toThrow('cannot be negative');
    });

    it('should throw error for invalid inputs', () => {
      expect(() => xlmToStroops(NaN)).toThrow('valid number');
      expect(() => xlmToStroops(Infinity)).toThrow('valid number');
      expect(() => xlmToStroops('100' as any)).toThrow('valid number');
      expect(() => xlmToStroops(null as any)).toThrow('valid number');
      expect(() => xlmToStroops(undefined as any)).toThrow('valid number');
    });
  });

  describe('stroopsToXlm', () => {
    it('should convert 10,000,000 stroops to 1 XLM', () => {
      expect(stroopsToXlm('10000000')).toBe(1);
    });

    it('should convert 0 stroops to 0 XLM', () => {
      expect(stroopsToXlm('0')).toBe(0);
    });

    it('should convert very small stroop amounts correctly', () => {
      expect(stroopsToXlm('1')).toBe(0.0000001); // Smallest unit
      expect(stroopsToXlm('10')).toBe(0.000001);
      expect(stroopsToXlm('100')).toBe(0.00001);
    });

    it('should convert large stroop amounts correctly', () => {
      expect(stroopsToXlm('1005000000')).toBe(100.5);
      expect(stroopsToXlm('5000000')).toBe(0.5);
      expect(stroopsToXlm('1234567890')).toBe(123.456789);
    });

    it('should convert very large stroop amounts correctly', () => {
      expect(stroopsToXlm('10000000000000')).toBe(1000000);
      expect(stroopsToXlm('9999999999999')).toBe(999999.9999999);
    });

    it('should throw error for negative amounts', () => {
      expect(() => stroopsToXlm('-1')).toThrow('cannot be negative');
      expect(() => stroopsToXlm('-1000000')).toThrow('cannot be negative');
    });

    it('should throw error for invalid inputs', () => {
      expect(() => stroopsToXlm('')).toThrow('valid string');
      expect(() => stroopsToXlm('   ')).toThrow('valid string');
      expect(() => stroopsToXlm('abc')).toThrow('valid numeric string');
      expect(() => stroopsToXlm('12.5')).toThrow('valid numeric string');
      expect(() => stroopsToXlm(100 as any)).toThrow('valid string');
      expect(() => stroopsToXlm(null as any)).toThrow('valid string');
      expect(() => stroopsToXlm(undefined as any)).toThrow('valid string');
    });
  });

  describe('Round-trip conversion', () => {
    it('should maintain value through XLM -> stroops -> XLM conversion', () => {
      const testValues = [
        0,
        0.0000001,
        0.5,
        1,
        10,
        100.5,
        123.4567890,
        1000,
        999999.9999999,
      ];

      testValues.forEach(xlm => {
        const stroops = xlmToStroops(xlm);
        const converted = stroopsToXlm(stroops);
        // Should be equal within 7 decimal places (Stellar precision)
        expect(converted).toBeCloseTo(xlm, 7);
      });
    });

    it('should handle precision limits correctly', () => {
      // Test that we properly handle the 7 decimal place limit
      const xlm = 123.45678901234; // More than 7 decimals
      const stroops = xlmToStroops(xlm);
      const converted = stroopsToXlm(stroops);
      
      // Should be close but may lose precision beyond 7 decimals
      expect(converted).toBeCloseTo(xlm, 7);
    });
  });

  describe('formatXlm', () => {
    it('should format with exactly 7 decimal places', () => {
      expect(formatXlm(1)).toBe('1.0000000');
      expect(formatXlm(0)).toBe('0.0000000');
      expect(formatXlm(100.5)).toBe('100.5000000');
    });

    it('should format very small amounts correctly', () => {
      expect(formatXlm(0.0000001)).toBe('0.0000001');
      expect(formatXlm(0.0000010)).toBe('0.0000010');
      expect(formatXlm(0.0000100)).toBe('0.0000100');
    });

    it('should format large amounts correctly', () => {
      expect(formatXlm(1000000)).toBe('1000000.0000000');
      expect(formatXlm(999999.9999999)).toBe('999999.9999999');
    });

    it('should format decimal amounts correctly', () => {
      expect(formatXlm(123.456789)).toBe('123.4567890');
      expect(formatXlm(0.5)).toBe('0.5000000');
      expect(formatXlm(100.1234567)).toBe('100.1234567');
    });

    it('should round amounts beyond 7 decimals', () => {
      expect(formatXlm(0.12345678)).toBe('0.1234568'); // Rounds up
      expect(formatXlm(0.12345671)).toBe('0.1234567'); // Rounds down
    });

    it('should throw error for negative amounts', () => {
      expect(() => formatXlm(-1)).toThrow('cannot be negative');
      expect(() => formatXlm(-0.5)).toThrow('cannot be negative');
    });

    it('should throw error for invalid inputs', () => {
      expect(() => formatXlm(NaN)).toThrow('valid number');
      expect(() => formatXlm(Infinity)).toThrow('valid number');
      expect(() => formatXlm('100' as any)).toThrow('valid number');
      expect(() => formatXlm(null as any)).toThrow('valid number');
      expect(() => formatXlm(undefined as any)).toThrow('valid number');
    });
  });

  describe('Edge cases for conversion functions', () => {
    it('should handle maximum safe integer values', () => {
      // JavaScript's MAX_SAFE_INTEGER is 9,007,199,254,740,991
      // In XLM that's about 900,719.9254740991
      const maxSafeXlm = 900000; // Stay well below the limit
      const stroops = xlmToStroops(maxSafeXlm);
      const converted = stroopsToXlm(stroops);
      expect(converted).toBe(maxSafeXlm);
    });

    it('should handle minimum positive value', () => {
      const minXlm = 0.0000001; // 1 stroop
      const stroops = xlmToStroops(minXlm);
      expect(stroops).toBe('1');
      expect(stroopsToXlm(stroops)).toBe(minXlm);
    });

    it('should handle values with many decimal places', () => {
      const xlm = 123.4567890123456789; // Many decimals
      const stroops = xlmToStroops(xlm);
      const converted = stroopsToXlm(stroops);
      // Should maintain precision up to 7 decimals
      expect(converted).toBeCloseTo(123.456789, 7);
    });
  });
});

describe('Balance Query Functions', () => {
  describe('getXlmBalance', () => {
    it('should throw error for invalid address', async () => {
      await expect(getXlmBalance('invalid')).rejects.toThrow('Invalid Stellar address');
    });

    // Note: The following tests would require mocking the Horizon API
    // or using actual testnet accounts. For now, we test the validation logic.
    
    it('should accept valid Stellar address format', async () => {
      const validAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      // This will fail without a mock, but validates the address check works
      try {
        await getXlmBalance(validAddress);
      } catch (error: any) {
        // Should not be an "Invalid Stellar address" error
        expect(error.message).not.toContain('Invalid Stellar address');
      }
    });
  });

  describe('getAccountBalances', () => {
    it('should throw error for invalid address', async () => {
      await expect(getAccountBalances('invalid')).rejects.toThrow('Invalid Stellar address');
    });

    it('should accept valid Stellar address format', async () => {
      const validAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      // This will fail without a mock, but validates the address check works
      try {
        await getAccountBalances(validAddress);
      } catch (error: any) {
        // Should not be an "Invalid Stellar address" error
        expect(error.message).not.toContain('Invalid Stellar address');
      }
    });
  });
});

describe('buildPaymentTransaction', () => {
  describe('Parameter validation', () => {
    it('should throw error for invalid source address', async () => {
      await expect(
        buildPaymentTransaction({
          sourceAddress: 'invalid',
          destinationAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          amount: '10000000',
        })
      ).rejects.toThrow('Invalid source address');
    });

    it('should throw error for invalid destination address', async () => {
      await expect(
        buildPaymentTransaction({
          sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          destinationAddress: 'invalid',
          amount: '10000000',
        })
      ).rejects.toThrow('Invalid destination address');
    });

    it('should throw error for invalid amount (not a string)', async () => {
      await expect(
        buildPaymentTransaction({
          sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: 100 as any,
        })
      ).rejects.toThrow('Amount must be provided as a string');
    });

    it('should throw error for invalid amount (empty string)', async () => {
      await expect(
        buildPaymentTransaction({
          sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: '',
        })
      ).rejects.toThrow('Amount must be provided as a string');
    });

    it('should throw error for invalid amount (negative)', async () => {
      await expect(
        buildPaymentTransaction({
          sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: '-10000000',
        })
      ).rejects.toThrow('Amount must be a positive number');
    });

    it('should throw error for invalid amount (zero)', async () => {
      await expect(
        buildPaymentTransaction({
          sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: '0',
        })
      ).rejects.toThrow('Amount must be a positive number');
    });

    it('should throw error for invalid amount (non-numeric)', async () => {
      await expect(
        buildPaymentTransaction({
          sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: 'abc',
        })
      ).rejects.toThrow('Amount must be a positive number');
    });

    it('should throw error for invalid memo type', async () => {
      await expect(
        buildPaymentTransaction({
          sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: '10000000',
          memo: 123 as any,
        })
      ).rejects.toThrow('Memo must be a string');
    });
  });

  describe('Transaction structure validation', () => {
    // Note: These tests would require mocking the Horizon API to avoid actual network calls
    // For now, we validate that the function accepts valid parameters
    
    it('should accept valid parameters without memo', async () => {
      const validParams = {
        sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        amount: '10000000', // 1 XLM in stroops
      };

      // This will fail without a mock or real account, but validates parameter acceptance
      try {
        await buildPaymentTransaction(validParams);
      } catch (error: any) {
        // Should not be a validation error
        expect(error.message).not.toContain('Invalid source address');
        expect(error.message).not.toContain('Invalid destination address');
        expect(error.message).not.toContain('Amount must be');
      }
    });

    it('should accept valid parameters with memo', async () => {
      const validParams = {
        sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        amount: '10000000', // 1 XLM in stroops
        memo: 'Test payment',
      };

      // This will fail without a mock or real account, but validates parameter acceptance
      try {
        await buildPaymentTransaction(validParams);
      } catch (error: any) {
        // Should not be a validation error
        expect(error.message).not.toContain('Invalid source address');
        expect(error.message).not.toContain('Invalid destination address');
        expect(error.message).not.toContain('Amount must be');
        expect(error.message).not.toContain('Memo must be');
      }
    });

    it('should accept empty memo string', async () => {
      const validParams = {
        sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        amount: '10000000',
        memo: '',
      };

      // This will fail without a mock or real account, but validates parameter acceptance
      try {
        await buildPaymentTransaction(validParams);
      } catch (error: any) {
        // Should not be a validation error
        expect(error.message).not.toContain('Memo must be');
      }
    });

    it('should accept memo with whitespace', async () => {
      const validParams = {
        sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        amount: '10000000',
        memo: '  Test payment  ',
      };

      // This will fail without a mock or real account, but validates parameter acceptance
      try {
        await buildPaymentTransaction(validParams);
      } catch (error: any) {
        // Should not be a validation error
        expect(error.message).not.toContain('Memo must be');
      }
    });
  });

  describe('Amount conversion', () => {
    it('should accept amount in stroops format', async () => {
      const validParams = {
        sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        amount: '1', // 1 stroop = 0.0000001 XLM
      };

      try {
        await buildPaymentTransaction(validParams);
      } catch (error: any) {
        // Should not be an amount validation error
        expect(error.message).not.toContain('Amount must be');
      }
    });

    it('should accept large amounts in stroops', async () => {
      const validParams = {
        sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        amount: '10000000000000', // 1,000,000 XLM
      };

      try {
        await buildPaymentTransaction(validParams);
      } catch (error: any) {
        // Should not be an amount validation error
        expect(error.message).not.toContain('Amount must be');
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle addresses with whitespace', async () => {
      const validParams = {
        sourceAddress: '  GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H  ',
        destinationAddress: '  GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7  ',
        amount: '10000000',
      };

      try {
        await buildPaymentTransaction(validParams);
      } catch (error: any) {
        // Should not be a validation error (addresses should be trimmed)
        expect(error.message).not.toContain('Invalid source address');
        expect(error.message).not.toContain('Invalid destination address');
      }
    });

    it('should handle federated addresses', async () => {
      const validParams = {
        sourceAddress: 'alice*example.com',
        destinationAddress: 'bob*stellar.org',
        amount: '10000000',
      };

      try {
        await buildPaymentTransaction(validParams);
      } catch (error: any) {
        // Should not be a validation error
        expect(error.message).not.toContain('Invalid source address');
        expect(error.message).not.toContain('Invalid destination address');
      }
    });

    it('should handle very long memos', async () => {
      const longMemo = 'A'.repeat(28); // Stellar memo text limit is 28 bytes
      const validParams = {
        sourceAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        destinationAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        amount: '10000000',
        memo: longMemo,
      };

      try {
        await buildPaymentTransaction(validParams);
      } catch (error: any) {
        // Should not be a memo validation error
        expect(error.message).not.toContain('Memo must be');
      }
    });
  });
});

describe('submitTransaction', () => {
  describe('Parameter validation', () => {
    it('should throw error for missing transaction', async () => {
      await expect(
        submitTransaction(null as any, 'some-xdr')
      ).rejects.toThrow('Transaction is required');
    });

    it('should throw error for missing signed XDR', async () => {
      const mockTransaction = {} as any;
      await expect(
        submitTransaction(mockTransaction, '')
      ).rejects.toThrow('Signed XDR is required');
    });

    it('should throw error for non-string signed XDR', async () => {
      const mockTransaction = {} as any;
      await expect(
        submitTransaction(mockTransaction, 123 as any)
      ).rejects.toThrow('Signed XDR is required');
    });
  });

  // Note: Full integration tests would require mocking Horizon API or using testnet
  // These tests validate the parameter validation logic
});

describe('sendXlmPayment', () => {
  // Mock wallet signer for testing
  const createMockWalletSigner = (overrides = {}) => ({
    isConnected: () => true,
    getPublicKey: () => 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    signTransaction: async (xdr: string) => xdr,
    ...overrides,
  });

  describe('Wallet validation', () => {
    it('should return error when wallet not connected', async () => {
      const walletSigner = createMockWalletSigner({
        isConnected: () => false,
      });

      const result = await sendXlmPayment(
        {
          recipientAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: 1,
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Wallet not connected');
    });

    it('should return error when unable to get public key', async () => {
      const walletSigner = createMockWalletSigner({
        getPublicKey: () => null,
      });

      const result = await sendXlmPayment(
        {
          recipientAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: 1,
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to get wallet address');
    });
  });

  describe('Parameter validation', () => {
    it('should return error for invalid recipient address', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendXlmPayment(
        {
          recipientAddress: 'invalid-address',
          amount: 1,
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Stellar');
    });

    it('should return error for invalid amount (NaN)', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendXlmPayment(
        {
          recipientAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: NaN,
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid amount');
    });

    it('should return error for invalid amount (negative)', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendXlmPayment(
        {
          recipientAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: -1,
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('greater than zero');
    });

    it('should return error for invalid amount (zero)', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendXlmPayment(
        {
          recipientAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: 0,
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('greater than zero');
    });
  });

  describe('Transaction signing', () => {
    it('should return error when signing fails', async () => {
      const walletSigner = createMockWalletSigner({
        signTransaction: async () => {
          throw new Error('User rejected');
        },
      });

      const result = await sendXlmPayment(
        {
          recipientAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
          amount: 1,
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('signing failed');
    });
  });

  // Note: Full integration tests would require mocking Horizon API or using testnet
  // These tests validate the core validation and error handling logic
});

describe('sendBulkXlmPayments', () => {
  // Mock wallet signer for testing
  const createMockWalletSigner = (overrides = {}) => ({
    isConnected: () => true,
    getPublicKey: () => 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    signTransaction: async (xdr: string) => xdr,
    ...overrides,
  });

  describe('Parameter validation', () => {
    it('should return error for missing recipients array', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        { recipients: null as any },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Recipients must be provided as an array');
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should return error for non-array recipients', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        { recipients: 'not-an-array' as any },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Recipients must be provided as an array');
    });

    it('should return error for empty recipients array', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        { recipients: [] },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one recipient is required');
      expect(result.processed).toBe(0);
    });

    it('should return error when wallet not connected', async () => {
      const walletSigner = createMockWalletSigner({
        isConnected: () => false,
      });

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', amount: 1 },
          ],
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Wallet not connected');
    });

    it('should return error when unable to get public key', async () => {
      const walletSigner = createMockWalletSigner({
        getPublicKey: () => null,
      });

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', amount: 1 },
          ],
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to get wallet address');
    });
  });

  describe('Recipient validation', () => {
    it('should return error for invalid recipient address', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'invalid-address', amount: 1 },
          ],
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation errors');
      expect(result.error).toContain('Recipient 1');
    });

    it('should return error for invalid amount (negative)', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', amount: -1 },
          ],
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation errors');
      expect(result.error).toContain('Invalid amount');
    });

    it('should return error for invalid amount (zero)', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', amount: 0 },
          ],
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation errors');
      expect(result.error).toContain('Invalid amount');
    });

    it('should return error for invalid amount (NaN)', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', amount: NaN },
          ],
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation errors');
      expect(result.error).toContain('Invalid amount');
    });

    it('should validate all recipients and report multiple errors', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'invalid-address-1', amount: 1 },
            { address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', amount: -5 },
            { address: 'invalid-address-2', amount: 0 },
          ],
        },
        walletSigner as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation errors');
      expect(result.error).toContain('Recipient 1');
      expect(result.error).toContain('Recipient 2');
      expect(result.error).toContain('Recipient 3');
    });
  });

  describe('Return value structure', () => {
    it('should return correct structure with txHashes array', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'invalid', amount: 1 },
          ],
        },
        walletSigner as any
      );

      expect(result).toHaveProperty('txHashes');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('failed');
      expect(Array.isArray(result.txHashes)).toBe(true);
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.processed).toBe('number');
      expect(typeof result.failed).toBe('number');
    });

    it('should return empty txHashes array for validation errors', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'invalid', amount: 1 },
          ],
        },
        walletSigner as any
      );

      expect(result.txHashes).toEqual([]);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('Memo handling', () => {
    it('should accept recipients with memos', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            {
              address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
              amount: 1,
              memo: 'Payment for Alice',
            },
          ],
        },
        walletSigner as any
      );

      // Should not fail validation due to memo
      if (result.error) {
        expect(result.error).not.toContain('memo');
      }
    });

    it('should accept recipients without memos', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            {
              address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
              amount: 1,
            },
          ],
        },
        walletSigner as any
      );

      // Should not fail validation due to missing memo
      if (result.error) {
        expect(result.error).not.toContain('memo');
      }
    });
  });

  describe('Multiple recipients', () => {
    it('should accept multiple valid recipients', async () => {
      const walletSigner = createMockWalletSigner();

      const recipients = [
        { address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', amount: 1 },
        { address: 'GC3C4AKRBQLHOJ45U4XG35ESVWRDECWO5XLDGYADO6DPR3L7KIDVUMML', amount: 2 },
        { address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H', amount: 3 },
      ];

      const result = await sendBulkXlmPayments(
        { recipients },
        walletSigner as any
      );

      // Should not fail validation
      if (result.error && result.error.includes('Validation errors')) {
        expect(result.error).not.toContain('Validation errors');
      }
    });

    it('should handle large number of recipients', async () => {
      const walletSigner = createMockWalletSigner();

      const recipients = Array.from({ length: 10 }, (_, i) => ({
        address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        amount: i + 1,
        memo: `Payment ${i + 1}`,
      }));

      const result = await sendBulkXlmPayments(
        { recipients },
        walletSigner as any
      );

      // Should not fail validation
      if (result.error && result.error.includes('Validation errors')) {
        expect(result.error).not.toContain('Validation errors');
      }
    }, 15000); // 15 second timeout for bulk payments with rate limiting
  });

  describe('Edge cases', () => {
    it('should handle recipients with whitespace in addresses', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            {
              address: '  GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7  ',
              amount: 1,
            },
          ],
        },
        walletSigner as any
      );

      // Should not fail validation (addresses should be trimmed)
      if (result.error && result.error.includes('Validation errors')) {
        expect(result.error).not.toContain('Recipient 1');
      }
    });

    it('should handle federated addresses', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'alice*example.com', amount: 1 },
            { address: 'bob*stellar.org', amount: 2 },
          ],
        },
        walletSigner as any
      );

      // Should not fail validation
      if (result.error && result.error.includes('Validation errors')) {
        expect(result.error).not.toContain('Validation errors');
      }
    });

    it('should handle very small amounts', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', amount: 0.0000001 },
          ],
        },
        walletSigner as any
      );

      // Should not fail validation
      if (result.error && result.error.includes('Validation errors')) {
        expect(result.error).not.toContain('Validation errors');
      }
    });

    it('should handle very large amounts', async () => {
      const walletSigner = createMockWalletSigner();

      const result = await sendBulkXlmPayments(
        {
          recipients: [
            { address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', amount: 1000000 },
          ],
        },
        walletSigner as any
      );

      // Should not fail validation
      if (result.error && result.error.includes('Validation errors')) {
        expect(result.error).not.toContain('Validation errors');
      }
    });
  });

  // Note: Full integration tests for sequential processing, rate limiting,
  // and error resilience would require mocking Horizon API or using testnet.
  // These tests validate the core validation and parameter handling logic.
});
