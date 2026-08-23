import React, { useState, useEffect } from 'react';
import { X, Wallet, ExternalLink, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStellarWallet } from '../utils/stellar-wallet';
import { StellarWalletType } from '../config/stellar-wallets';
import { STELLAR_WALLETS } from '../config/stellar-wallets';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { connect, isWalletInstalled, error, isLoading } = useStellarWallet();
  const [connectingWallet, setConnectingWallet] = useState<StellarWalletType | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore scroll position
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Clear error when modal opens
  useEffect(() => {
    if (isOpen) {
      setConnectionError(null);
    }
  }, [isOpen]);

  // Update connection error from context
  useEffect(() => {
    if (error) {
      setConnectionError(error);
    }
  }, [error]);

  const handleConnect = async (walletType: StellarWalletType) => {
    try {
      setConnectingWallet(walletType);
      setConnectionError(null);
      
      await connect(walletType);
      
      // Close modal after successful connection
      setTimeout(() => {
        onClose();
        setConnectingWallet(null);
      }, 500);
    } catch (error: any) {
      console.error('Failed to connect:', error);
      setConnectionError(error.message || 'Failed to connect wallet. Please try again.');
      setConnectingWallet(null);
    }
  };

  // Get all Stellar wallet configurations
  const walletConfigs = Object.values(STELLAR_WALLETS);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative z-[101]"
              style={{ maxHeight: 'calc(100vh - 2rem)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Connect Wallet</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Wallet List */}
              <div className="p-6 space-y-3">
                {connectionError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-red-800">{connectionError}</p>
                    </div>
                  </div>
                )}
                
                {walletConfigs.map((wallet) => {
                  const installed = isWalletInstalled(wallet.id);
                  const isConnecting = connectingWallet === wallet.id;
                  const isDisabled = isLoading && !isConnecting;

                  return (
                    <button
                      key={wallet.id}
                      onClick={() => handleConnect(wallet.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center space-x-4 p-4 rounded-lg border-2 transition-all duration-200 ${
                        isConnecting
                          ? 'border-gray-900 bg-gray-50'
                          : isDisabled
                          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {wallet.icon ? (
                        <div className="w-12 h-12 flex-shrink-0">
                          <img 
                            src={wallet.icon} 
                            alt={wallet.name}
                            className="w-full h-full object-contain rounded-lg"
                            onError={(e) => {
                              // Fallback to generic wallet icon if image fails to load
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML = `
                                <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                  <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                  </svg>
                                </div>
                              `;
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 flex items-center space-x-2">
                          <span>{wallet.name}</span>
                          {wallet.requiresInstallation && !installed && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                              Not Installed
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {wallet.description}
                        </div>
                      </div>
                      {isConnecting ? (
                        <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ExternalLink className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-500 text-center">
                  By connecting, you agree to Gemetra's Terms of Service and Privacy Policy
                </p>
                <div className="mt-3 text-center">
                  <a
                    href="https://www.stellar.org/learn/intro-to-stellar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    Don't have a wallet? Learn more about Stellar
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
