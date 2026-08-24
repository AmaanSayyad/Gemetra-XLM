import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppNav, BottomNav } from '../gemetra-ui';
import { Dashboard } from '../components/Dashboard';
import { SettingsPage } from '../components/SettingsPage';
import { AIAssistantPage } from '../components/AIAssistantPage';
import { ChatHistoryPage } from '../components/ChatHistoryPage';
import { VATRefundPage } from '../components/VATRefundPage';
import { VATAdminPage } from '../components/VATAdminPage';
import { RefundHistoryPage } from '../components/RefundHistoryPage';
import { PointsDisplay } from '../components/PointsDisplay';
import { useStellarWallet } from '../utils/stellar-wallet';
import { usePayments } from '../hooks/usePayments';
import { usePoints } from '../hooks/usePoints';
import { isAdminAddress } from '../config/treasury';

const VALID_TABS = [
  'dashboard',
  'vat-refund',
  'refund-history',
  'vat-admin',
  'ai-assistant-chat',
  'ai-assistant-history',
  'settings',
] as const;

const NAV = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'vat-refund', label: 'Submit Refund' },
  { id: 'refund-history', label: 'My Claims' },
  { id: 'ai-assistant-chat', label: 'AI Assistant' },
  { id: 'settings', label: 'Settings' },
];

export const AppShell: React.FC<{ onGoHome?: () => void; featuredCountryCode?: string | null }> = ({
  onGoHome,
  featuredCountryCode,
}) => {
  const { walletState, disconnect } = useStellarWallet();
  const { getAllPayments } = usePayments();
  const { syncVatRefundPoints } = usePoints();
  const address = walletState.publicKey;
  const isConnected = walletState.isConnected;

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('gemetra_active_tab');
    return saved && VALID_TABS.includes(saved as (typeof VALID_TABS)[number]) ? saved : 'dashboard';
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedChatSessionId, setSelectedChatSessionId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('gemetra_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!isConnected || !address) return;
    getAllPayments().then((payments) => {
      const completed = payments.filter(
        (p) => p.employee_id === 'vat-refund' && p.status === 'completed'
      );
      syncVatRefundPoints(completed);
    });
  }, [isConnected, address, getAllPayments, syncVatRefundPoints, refreshKey]);

  const isAdmin = isAdminAddress(address);

  const navLinks = isAdmin
    ? [...NAV.slice(0, 3), { id: 'vat-admin', label: 'Admin' }, ...NAV.slice(3)]
    : NAV;

  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} refreshKey={refreshKey} featuredCountryCode={featuredCountryCode} />;
      case 'vat-refund':
        return (
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <div className="gem-vat-shell overflow-hidden">
              <VATRefundPage
                onViewHistory={() => setActiveTab('refund-history')}
                onClaimComplete={bumpRefresh}
                initialCountryCode={featuredCountryCode}
              />
            </div>
          </div>
        );
      case 'refund-history':
        return (
          <RefundHistoryPage
            refreshKey={refreshKey}
            onBack={() => setActiveTab('dashboard')}
            onSubmitRefund={() => setActiveTab('vat-refund')}
          />
        );
      case 'vat-admin':
        return (
          <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
            <VATAdminPage />
          </div>
        );
      case 'ai-assistant-chat':
        return (
          <div className="mx-auto h-[calc(100dvh-4.5rem)] max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
            <AIAssistantPage
              sessionId={selectedChatSessionId}
              onSessionCreated={(id) => setSelectedChatSessionId(id)}
              onOpenHistory={() => setActiveTab('ai-assistant-history')}
              onNewChat={() => setSelectedChatSessionId(null)}
            />
          </div>
        );
      case 'ai-assistant-history':
        return (
          <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
            <ChatHistoryPage
              onSelectSession={(id) => {
                setSelectedChatSessionId(id);
                setActiveTab('ai-assistant-chat');
              }}
              onBack={() => setActiveTab('ai-assistant-chat')}
            />
          </div>
        );
      case 'settings':
        return <SettingsPage onBack={() => setActiveTab('dashboard')} />;
      default:
        return <Dashboard setActiveTab={setActiveTab} refreshKey={refreshKey} featuredCountryCode={featuredCountryCode} />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gem-surface-muted)] gem-sans">
      <AppNav
        activeId={activeTab}
        links={navLinks}
        walletAddress={address}
        onLogoClick={onGoHome}
        onNavigate={(id) => {
          if (id === 'ai-assistant-chat') setSelectedChatSessionId(null);
          setActiveTab(id);
        }}
        onDisconnect={() => disconnect()}
        trailingSlot={
          isConnected && address ? (
            <PointsDisplay
              walletAddress={address}
              isWalletConnected={isConnected}
              onViewRefunds={() => setActiveTab('refund-history')}
            />
          ) : null
        }
      />

      <main className="pb-8 md:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav
        active={['settings'].includes(activeTab) ? 'profile' : 'home'}
        onHome={() => setActiveTab('dashboard')}
        onProfile={() => setActiveTab('settings')}
      />
    </div>
  );
};

export default AppShell;
