/**
 * Stellar Wallet Configuration Module
 * 
 * This module provides configuration for Stellar wallet integrations,
 * including wallet types, metadata, and detection methods.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

/**
 * Enum for supported Stellar wallet types
 */
export enum StellarWalletType {
  Freighter = 'freighter',
  Albedo = 'albedo',
}

/**
 * Configuration interface for a Stellar wallet
 */
export interface StellarWalletConfig {
  /** Unique identifier for the wallet */
  id: StellarWalletType;
  
  /** Display name of the wallet */
  name: string;
  
  /** Description of the wallet */
  description: string;
  
  /** Path to the wallet icon */
  icon: string;
  
  /** URL to install/download the wallet */
  installUrl: string;
  
  /** Whether the wallet requires installation (browser extension) */
  requiresInstallation: boolean;
  
  /** Function to check if the wallet is installed/available */
  isInstalled: () => boolean;
}

/**
 * Check if Freighter wallet is installed
 * Freighter injects itself into the window object
 * 
 * @returns true if Freighter is installed, false otherwise
 */
export function isFreighterInstalled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  // Freighter injects itself as window.freighter
  return typeof (window as any).freighter !== 'undefined';
}

/**
 * Check if Albedo wallet is available
 * Albedo is web-based and always available (no installation required)
 * 
 * @returns always true since Albedo is web-based
 */
export function isAlbedoAvailable(): boolean {
  // Albedo is web-based and always available
  return true;
}

/**
 * Configuration object for all supported Stellar wallets
 */
export const STELLAR_WALLETS: Record<StellarWalletType, StellarWalletConfig> = {
  [StellarWalletType.Freighter]: {
    id: StellarWalletType.Freighter,
    name: 'Freighter',
    description: 'Browser extension wallet for Stellar',
    icon: '/freighter-icon.svg',
    installUrl: 'https://www.freighter.app/',
    requiresInstallation: true,
    isInstalled: isFreighterInstalled,
  },
  
  [StellarWalletType.Albedo]: {
    id: StellarWalletType.Albedo,
    name: 'Albedo',
    description: 'Web-based Stellar wallet',
    icon: '/albedo-icon.svg',
    installUrl: 'https://albedo.link/',
    requiresInstallation: false,
    isInstalled: isAlbedoAvailable,
  },
};

/**
 * Get configuration for a specific wallet type
 * 
 * @param walletType - The wallet type to get configuration for
 * @returns Wallet configuration object
 */
export function getWalletConfig(walletType: StellarWalletType): StellarWalletConfig {
  return STELLAR_WALLETS[walletType];
}

/**
 * Get all available wallet configurations
 * 
 * @returns Array of all wallet configurations
 */
export function getAllWalletConfigs(): StellarWalletConfig[] {
  return Object.values(STELLAR_WALLETS);
}

/**
 * Get all installed/available wallets
 * 
 * @returns Array of wallet configurations for installed/available wallets
 */
export function getAvailableWallets(): StellarWalletConfig[] {
  return getAllWalletConfigs().filter(wallet => wallet.isInstalled());
}

/**
 * Check if a specific wallet type is installed/available
 * 
 * @param walletType - The wallet type to check
 * @returns true if the wallet is installed/available, false otherwise
 */
export function isWalletAvailable(walletType: StellarWalletType): boolean {
  const config = getWalletConfig(walletType);
  return config.isInstalled();
}
