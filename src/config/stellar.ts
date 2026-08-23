/**
 * Stellar Network Configuration Module
 * 
 * This module provides configuration for connecting to Stellar networks
 * (mainnet and testnet) and manages Horizon server instances.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * Configuration interface for Stellar network
 */
export interface StellarConfig {
  networkPassphrase: string;
  horizonUrl: string;
  networkType: 'mainnet' | 'testnet';
}

/**
 * Network configurations for mainnet and testnet
 */
interface StellarNetworks {
  mainnet: StellarConfig;
  testnet: StellarConfig;
}

/**
 * Stellar network configurations
 */
const STELLAR_NETWORKS: StellarNetworks = {
  mainnet: {
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org',
    networkType: 'mainnet',
  },
  testnet: {
    networkPassphrase: StellarSdk.Networks.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkType: 'testnet',
  },
};

/**
 * Cached Horizon Server instances to avoid recreation
 */
const serverCache: Map<'mainnet' | 'testnet', StellarSdk.Horizon.Server> = new Map();

/**
 * Current active network (defaults to testnet for safety)
 */
let currentNetwork: 'mainnet' | 'testnet' = 'testnet';

/**
 * Get Stellar configuration for a specific network
 * 
 * @param network - The network type ('mainnet' or 'testnet')
 * @returns StellarConfig object with network details
 */
export function getStellarConfig(network: 'mainnet' | 'testnet'): StellarConfig {
  return STELLAR_NETWORKS[network];
}

/**
 * Get or create a cached Horizon Server instance
 * 
 * @param network - Optional network type (defaults to current network)
 * @returns Horizon Server instance
 */
export function getHorizonServer(network?: 'mainnet' | 'testnet'): StellarSdk.Horizon.Server {
  const targetNetwork = network || currentNetwork;
  
  // Return cached server if available
  if (serverCache.has(targetNetwork)) {
    return serverCache.get(targetNetwork)!;
  }
  
  // Create new server instance
  const config = getStellarConfig(targetNetwork);
  const server = new StellarSdk.Horizon.Server(config.horizonUrl);
  
  // Cache the server instance
  serverCache.set(targetNetwork, server);
  
  return server;
}

/**
 * Get the current active network
 * 
 * @returns Current network type ('mainnet' or 'testnet')
 */
export function getCurrentNetwork(): 'mainnet' | 'testnet' {
  return currentNetwork;
}

/**
 * Switch to a different Stellar network
 * 
 * @param network - The network to switch to ('mainnet' or 'testnet')
 */
export function switchNetwork(network: 'mainnet' | 'testnet'): void {
  currentNetwork = network;
}

/**
 * Validate Horizon connection before allowing transactions
 * 
 * This function checks if the Horizon server is reachable and responding
 * by making a simple API call to get the root endpoint.
 * 
 * @param network - Optional network to validate (defaults to current network)
 * @returns Promise that resolves to true if connection is valid, false otherwise
 */
export async function validateHorizonConnection(
  network?: 'mainnet' | 'testnet'
): Promise<boolean> {
  try {
    const server = getHorizonServer(network);
    
    // Try to fetch the root endpoint to verify connection
    // This is a lightweight call that doesn't require authentication
    await server.fetchTimebounds(100);
    
    return true;
  } catch (error) {
    console.error('Horizon connection validation failed:', error);
    return false;
  }
}

/**
 * Initialize Stellar configuration from environment variables
 * 
 * This function should be called on application startup to set the
 * initial network based on environment configuration.
 */
export function initializeStellarConfig(): void {
  // Check environment variable for network configuration
  const envNetwork = import.meta.env.VITE_STELLAR_NETWORK;
  
  if (envNetwork === 'mainnet' || envNetwork === 'testnet') {
    currentNetwork = envNetwork;
  } else {
    // Default to testnet for safety
    currentNetwork = 'testnet';
    console.warn(
      'VITE_STELLAR_NETWORK not set or invalid. Defaulting to testnet.'
    );
  }
  
  // Pre-initialize the server for the current network
  getHorizonServer(currentNetwork);
}
