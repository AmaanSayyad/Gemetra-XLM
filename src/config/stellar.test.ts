/**
 * Unit tests for Stellar Configuration Module
 * 
 * Tests Requirements: 1.1, 1.2, 1.3, 1.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  getStellarConfig,
  getHorizonServer,
  getCurrentNetwork,
  switchNetwork,
  validateHorizonConnection,
  initializeStellarConfig,
} from './stellar';

describe('Stellar Configuration Module', () => {
  describe('getStellarConfig', () => {
    it('should return mainnet configuration', () => {
      const config = getStellarConfig('mainnet');
      
      expect(config.networkType).toBe('mainnet');
      expect(config.horizonUrl).toBe('https://horizon.stellar.org');
      expect(config.networkPassphrase).toBe(StellarSdk.Networks.PUBLIC);
    });

    it('should return testnet configuration', () => {
      const config = getStellarConfig('testnet');
      
      expect(config.networkType).toBe('testnet');
      expect(config.horizonUrl).toBe('https://horizon-testnet.stellar.org');
      expect(config.networkPassphrase).toBe(StellarSdk.Networks.TESTNET);
    });
  });

  describe('getHorizonServer', () => {
    it('should return a Horizon Server instance', () => {
      const server = getHorizonServer('testnet');
      
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(StellarSdk.Horizon.Server);
    });

    it('should cache server instances', () => {
      const server1 = getHorizonServer('testnet');
      const server2 = getHorizonServer('testnet');
      
      // Should return the same cached instance
      expect(server1).toBe(server2);
    });

    it('should create separate instances for different networks', () => {
      const mainnetServer = getHorizonServer('mainnet');
      const testnetServer = getHorizonServer('testnet');
      
      // Should be different instances
      expect(mainnetServer).not.toBe(testnetServer);
    });

    it('should use current network when no parameter provided', () => {
      switchNetwork('testnet');
      const server = getHorizonServer();
      
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(StellarSdk.Horizon.Server);
    });
  });

  describe('getCurrentNetwork and switchNetwork', () => {
    beforeEach(() => {
      // Reset to testnet before each test
      switchNetwork('testnet');
    });

    it('should return current network', () => {
      expect(getCurrentNetwork()).toBe('testnet');
    });

    it('should switch to mainnet', () => {
      switchNetwork('mainnet');
      expect(getCurrentNetwork()).toBe('mainnet');
    });

    it('should switch to testnet', () => {
      switchNetwork('mainnet');
      switchNetwork('testnet');
      expect(getCurrentNetwork()).toBe('testnet');
    });
  });

  describe('validateHorizonConnection', () => {
    it('should validate testnet connection', async () => {
      const isValid = await validateHorizonConnection('testnet');
      
      // This should succeed if network is available
      expect(typeof isValid).toBe('boolean');
    }, 10000); // 10 second timeout for network call

    it('should handle connection validation for current network', async () => {
      switchNetwork('testnet');
      const isValid = await validateHorizonConnection();
      
      expect(typeof isValid).toBe('boolean');
    }, 10000);
  });

  describe('initializeStellarConfig', () => {
    it('should initialize without errors', () => {
      expect(() => initializeStellarConfig()).not.toThrow();
    });

    it('should set a default network', () => {
      initializeStellarConfig();
      const network = getCurrentNetwork();
      
      expect(network === 'mainnet' || network === 'testnet').toBe(true);
    });
  });

  describe('Network Configuration Correctness', () => {
    it('should have correct mainnet Horizon URL', () => {
      const config = getStellarConfig('mainnet');
      expect(config.horizonUrl).toBe('https://horizon.stellar.org');
    });

    it('should have correct testnet Horizon URL', () => {
      const config = getStellarConfig('testnet');
      expect(config.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    });

    it('should use Stellar SDK network passphrases', () => {
      const mainnetConfig = getStellarConfig('mainnet');
      const testnetConfig = getStellarConfig('testnet');
      
      expect(mainnetConfig.networkPassphrase).toBe(StellarSdk.Networks.PUBLIC);
      expect(testnetConfig.networkPassphrase).toBe(StellarSdk.Networks.TESTNET);
    });
  });
});
