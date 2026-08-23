/**
 * Unit tests for Stellar Wallet Configuration Module
 * 
 * Tests Requirements: 3.1, 3.2, 3.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StellarWalletType,
  StellarWalletConfig,
  STELLAR_WALLETS,
  isFreighterInstalled,
  isAlbedoAvailable,
  getWalletConfig,
  getAllWalletConfigs,
  getAvailableWallets,
  isWalletAvailable,
} from './stellar-wallets';

describe('Stellar Wallet Configuration Module', () => {
  describe('StellarWalletType enum', () => {
    it('should have Freighter wallet type', () => {
      expect(StellarWalletType.Freighter).toBe('freighter');
    });

    it('should have Albedo wallet type', () => {
      expect(StellarWalletType.Albedo).toBe('albedo');
    });
  });

  describe('isFreighterInstalled', () => {
    beforeEach(() => {
      // Clean up window.freighter before each test
      if (typeof window !== 'undefined') {
        delete (window as any).freighter;
      }
    });

    it('should return false when Freighter is not installed', () => {
      expect(isFreighterInstalled()).toBe(false);
    });

    it('should return true when Freighter is installed', () => {
      // Mock Freighter installation
      (window as any).freighter = {};
      
      expect(isFreighterInstalled()).toBe(true);
      
      // Cleanup
      delete (window as any).freighter;
    });
  });

  describe('isAlbedoAvailable', () => {
    it('should always return true (web-based wallet)', () => {
      expect(isAlbedoAvailable()).toBe(true);
    });
  });

  describe('STELLAR_WALLETS configuration', () => {
    it('should have Freighter configuration', () => {
      const freighter = STELLAR_WALLETS[StellarWalletType.Freighter];
      
      expect(freighter).toBeDefined();
      expect(freighter.id).toBe(StellarWalletType.Freighter);
      expect(freighter.name).toBe('Freighter');
      expect(freighter.description).toBe('Browser extension wallet for Stellar');
      expect(freighter.icon).toBe('/freighter-icon.svg');
      expect(freighter.installUrl).toBe('https://www.freighter.app/');
      expect(freighter.requiresInstallation).toBe(true);
      expect(typeof freighter.isInstalled).toBe('function');
    });

    it('should have Albedo configuration', () => {
      const albedo = STELLAR_WALLETS[StellarWalletType.Albedo];
      
      expect(albedo).toBeDefined();
      expect(albedo.id).toBe(StellarWalletType.Albedo);
      expect(albedo.name).toBe('Albedo');
      expect(albedo.description).toBe('Web-based Stellar wallet');
      expect(albedo.icon).toBe('/albedo-icon.svg');
      expect(albedo.installUrl).toBe('https://albedo.link/');
      expect(albedo.requiresInstallation).toBe(false);
      expect(typeof albedo.isInstalled).toBe('function');
    });
  });

  describe('getWalletConfig', () => {
    it('should return Freighter configuration', () => {
      const config = getWalletConfig(StellarWalletType.Freighter);
      
      expect(config).toBeDefined();
      expect(config.id).toBe(StellarWalletType.Freighter);
      expect(config.name).toBe('Freighter');
    });

    it('should return Albedo configuration', () => {
      const config = getWalletConfig(StellarWalletType.Albedo);
      
      expect(config).toBeDefined();
      expect(config.id).toBe(StellarWalletType.Albedo);
      expect(config.name).toBe('Albedo');
    });
  });

  describe('getAllWalletConfigs', () => {
    it('should return all wallet configurations', () => {
      const configs = getAllWalletConfigs();
      
      expect(configs).toHaveLength(2);
      expect(configs.some(c => c.id === StellarWalletType.Freighter)).toBe(true);
      expect(configs.some(c => c.id === StellarWalletType.Albedo)).toBe(true);
    });

    it('should return array of StellarWalletConfig objects', () => {
      const configs = getAllWalletConfigs();
      
      configs.forEach(config => {
        expect(config).toHaveProperty('id');
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('icon');
        expect(config).toHaveProperty('installUrl');
        expect(config).toHaveProperty('requiresInstallation');
        expect(config).toHaveProperty('isInstalled');
      });
    });
  });

  describe('getAvailableWallets', () => {
    beforeEach(() => {
      // Clean up window.freighter before each test
      if (typeof window !== 'undefined') {
        delete (window as any).freighter;
      }
    });

    it('should return only Albedo when Freighter is not installed', () => {
      const available = getAvailableWallets();
      
      expect(available).toHaveLength(1);
      expect(available[0].id).toBe(StellarWalletType.Albedo);
    });

    it('should return both wallets when Freighter is installed', () => {
      // Mock Freighter installation
      (window as any).freighter = {};
      
      const available = getAvailableWallets();
      
      expect(available).toHaveLength(2);
      expect(available.some(w => w.id === StellarWalletType.Freighter)).toBe(true);
      expect(available.some(w => w.id === StellarWalletType.Albedo)).toBe(true);
      
      // Cleanup
      delete (window as any).freighter;
    });
  });

  describe('isWalletAvailable', () => {
    beforeEach(() => {
      // Clean up window.freighter before each test
      if (typeof window !== 'undefined') {
        delete (window as any).freighter;
      }
    });

    it('should return false for Freighter when not installed', () => {
      expect(isWalletAvailable(StellarWalletType.Freighter)).toBe(false);
    });

    it('should return true for Freighter when installed', () => {
      // Mock Freighter installation
      (window as any).freighter = {};
      
      expect(isWalletAvailable(StellarWalletType.Freighter)).toBe(true);
      
      // Cleanup
      delete (window as any).freighter;
    });

    it('should always return true for Albedo', () => {
      expect(isWalletAvailable(StellarWalletType.Albedo)).toBe(true);
    });
  });

  describe('Wallet metadata', () => {
    it('should have valid install URLs', () => {
      const configs = getAllWalletConfigs();
      
      configs.forEach(config => {
        expect(config.installUrl).toMatch(/^https?:\/\//);
      });
    });

    it('should have icon paths', () => {
      const configs = getAllWalletConfigs();
      
      configs.forEach(config => {
        expect(config.icon).toBeTruthy();
        expect(typeof config.icon).toBe('string');
      });
    });

    it('should have descriptive names and descriptions', () => {
      const configs = getAllWalletConfigs();
      
      configs.forEach(config => {
        expect(config.name).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(config.name.length).toBeGreaterThan(0);
        expect(config.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Wallet installation requirements', () => {
    it('should mark Freighter as requiring installation', () => {
      const freighter = getWalletConfig(StellarWalletType.Freighter);
      expect(freighter.requiresInstallation).toBe(true);
    });

    it('should mark Albedo as not requiring installation', () => {
      const albedo = getWalletConfig(StellarWalletType.Albedo);
      expect(albedo.requiresInstallation).toBe(false);
    });
  });
});
