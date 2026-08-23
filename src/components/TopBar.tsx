import React, { useState } from 'react';
import { Bell, Search } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { PointsDisplay } from './PointsDisplay';
import { useNotifications } from '../hooks/useNotifications';
import { useStellarWallet } from '../utils/stellar-wallet';

interface TopBarProps {
  activeTab: string;
}

export const TopBar: React.FC<TopBarProps> = ({ activeTab }) => {
  const { notifications} = useNotifications();
  const { walletState } = useStellarWallet();
  const address = walletState.publicKey;
  const isConnected = walletState.isConnected;
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: 'Dashboard',
          subtitle: 'Track VAT refunds and your Stellar wallet balance.'
        };
      case 'vat-refund':
        return {
          title: 'VAT Refund',
          subtitle: 'Submit receipts and receive refunds in XLM.'
        };
      case 'vat-admin':
        return {
          title: 'VAT Admin',
          subtitle: 'Review and process refund claims.'
        };
      case 'ai-assistant-chat':
        return {
          title: 'AI Assistant',
          subtitle: 'Get help with VAT refunds, Stellar, and XLM.'
        };
      case 'ai-assistant-history':
        return {
          title: 'Chat History',
          subtitle: 'View and manage your AI conversation history.'
        };
      case 'settings':
        return {
          title: 'Settings',
          subtitle: 'Manage your account and wallet preferences.'
        };
      default:
        return {
          title: 'Dashboard',
          subtitle: 'Track VAT refunds and your Stellar wallet balance.'
        };
    }
  };

  const { title, subtitle } = getPageTitle();

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  return (
    <div className="bg-white border-b border-gray-200 px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center justify-between">
        {/* Page Title */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 text-xs sm:text-sm mt-1">{subtitle}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Points Display */}
          {isConnected && address && (
            <PointsDisplay walletAddress={address} isWalletConnected={isConnected} />
          )}

          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-gray-100 border border-gray-300 text-gray-900 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 w-64 text-sm"
            />
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={toggleNotifications}
              className="relative p-2 text-gray-500 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <NotificationDropdown
                isOpen={showNotifications}
                onToggle={toggleNotifications}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};