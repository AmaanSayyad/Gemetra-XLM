/**
 * Integration tests for Stellar Balance Query Functions
 * 
 * These tests use real Stellar testnet accounts to verify balance queries work correctly.
 * 
 * Tests Requirements: 7.1, 7.2, 20.2
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getXlmBalance, getAccountBalances, clearBalanceCache } from './stellar';
import { switchNetwork } from '../config/stellar';

describe('Balance Query Integration Tests', () => {
  // Use a well-known Stellar testnet account (Friendbot's own account)
  const TEST_ACCOUNT = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
  
  beforeAll(() => {
    // Switch to testnet for integration tests
    switchNetwork('testnet');
  });

  describe('getXlmBalance', () => {
    it('should query balance for a funded testnet account', async () => {
      const balance = await getXlmBalance(TEST_ACCOUNT);
      
      // Balance should be a number
      expect(typeof balance).toBe('number');
      
      // Balance should be non-negative
      expect(balance).toBeGreaterThanOrEqual(0);
      
      // Balance should be finite
      expect(isFinite(balance)).toBe(true);
    }, 10000); // 10 second timeout for network call

    it('should handle unfunded accounts gracefully', async () => {
      // Use a valid but likely unfunded account address
      // Note: This test verifies the function handles 404 errors gracefully
      // If the account happens to be funded, we just verify it returns a valid balance
      const testAccount = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
      
      const balance = await getXlmBalance(testAccount);
      
      // Should return a valid number (0 if unfunded, or actual balance if funded)
      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
      expect(isFinite(balance)).toBe(true);
    }, 10000);

    it('should use cache for repeated queries within 10 seconds', async () => {
      // Clear cache first
      clearBalanceCache(TEST_ACCOUNT);
      
      const startTime = Date.now();
      const firstBalance = await getXlmBalance(TEST_ACCOUNT);
      const firstCallTime = Date.now() - startTime;
      
      const secondStartTime = Date.now();
      const secondBalance = await getXlmBalance(TEST_ACCOUNT);
      const secondCallTime = Date.now() - secondStartTime;
      
      // Second call should be much faster (cached)
      expect(secondCallTime).toBeLessThan(firstCallTime / 10);
      
      // Balances should be the same
      expect(secondBalance).toBe(firstBalance);
    }, 15000);
  });

  describe('getAccountBalances', () => {
    it('should return detailed balance information', async () => {
      const balances = await getAccountBalances(TEST_ACCOUNT);
      
      // Should have all required fields
      expect(balances).toHaveProperty('xlm');
      expect(balances).toHaveProperty('availableXlm');
      expect(balances).toHaveProperty('minimumReserve');
      
      // All values should be numbers
      expect(typeof balances.xlm).toBe('number');
      expect(typeof balances.availableXlm).toBe('number');
      expect(typeof balances.minimumReserve).toBe('number');
      
      // All values should be non-negative
      expect(balances.xlm).toBeGreaterThanOrEqual(0);
      expect(balances.availableXlm).toBeGreaterThanOrEqual(0);
      expect(balances.minimumReserve).toBeGreaterThan(0);
      
      // Available balance should be less than or equal to total balance
      expect(balances.availableXlm).toBeLessThanOrEqual(balances.xlm);
      
      // Minimum reserve should be at least 1 XLM (base reserve)
      expect(balances.minimumReserve).toBeGreaterThanOrEqual(1);
    }, 10000);

    it('should handle unfunded accounts gracefully', async () => {
      // Use a valid but likely unfunded account address
      const testAccount = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
      
      const balances = await getAccountBalances(testAccount);
      
      // Should return valid balance information
      expect(balances).toHaveProperty('xlm');
      expect(balances).toHaveProperty('availableXlm');
      expect(balances).toHaveProperty('minimumReserve');
      
      // All values should be valid numbers
      expect(typeof balances.xlm).toBe('number');
      expect(typeof balances.availableXlm).toBe('number');
      expect(typeof balances.minimumReserve).toBe('number');
      
      // All values should be non-negative
      expect(balances.xlm).toBeGreaterThanOrEqual(0);
      expect(balances.availableXlm).toBeGreaterThanOrEqual(0);
      expect(balances.minimumReserve).toBeGreaterThan(0);
    }, 10000);

    it('should calculate available balance correctly', async () => {
      const balances = await getAccountBalances(TEST_ACCOUNT);
      
      // Available balance should equal total minus minimum reserve
      const expectedAvailable = Math.max(0, balances.xlm - balances.minimumReserve);
      
      expect(balances.availableXlm).toBeCloseTo(expectedAvailable, 7);
    }, 10000);
  });

  describe('Cache behavior', () => {
    it('should cache results for both functions', async () => {
      clearBalanceCache(TEST_ACCOUNT);
      
      // Call getXlmBalance first
      const balance1 = await getXlmBalance(TEST_ACCOUNT);
      
      // Call getAccountBalances - should use same cache
      const startTime = Date.now();
      const balances = await getAccountBalances(TEST_ACCOUNT);
      const callTime = Date.now() - startTime;
      
      // Should be very fast (cached)
      expect(callTime).toBeLessThan(50);
      
      // Balance should match
      expect(balances.xlm).toBe(balance1);
    }, 15000);

    it('should clear cache correctly', async () => {
      // Query to populate cache
      await getXlmBalance(TEST_ACCOUNT);
      
      // Clear cache
      clearBalanceCache(TEST_ACCOUNT);
      
      // Next query should make a new API call (will be slower)
      const startTime = Date.now();
      await getXlmBalance(TEST_ACCOUNT);
      const callTime = Date.now() - startTime;
      
      // Should take some time (not instant from cache)
      expect(callTime).toBeGreaterThan(50);
    }, 15000);
  });
});
