import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Settings,  
  LogOut, 
  Menu, 
  X,
  ChevronDown,
  Bot,
  MessageSquare,
  History,
  Receipt,
  Wallet,
  Copy,
  Check,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { formatStellarAddress } from '../utils/stellar';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import ConnectButton from '../utils/connect-wallet';
import { useStellarWallet } from '../utils/stellar-wallet';
import { isAdminAddress } from '../config/treasury';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isWalletConnected: boolean;
  walletAddress: string;
  user?: SupabaseUser | null;
  companyName?: string;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isWalletConnected,
  walletAddress,
  user,
  companyName,
  onToggleCollapse
}) => {
  const { signOut } = useAuth();
  const { disconnect } = useStellarWallet();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showAIAssistantDropdown, setShowAIAssistantDropdown] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [mobileDropdownModal, setMobileDropdownModal] = useState<{
    isOpen: boolean;
    type: 'ai-assistant' | null;
    buttonRect?: DOMRect;
  }>({ isOpen: false, type: null });

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileOpen(false);
        setMobileDropdownModal({ isOpen: false, type: null });
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleCollapse = () => {
    if (isMobile) {
      setIsMobileOpen(!isMobileOpen);
    } else {
      const newCollapsed = !isCollapsed;
      setIsCollapsed(newCollapsed);
      onToggleCollapse?.(newCollapsed);
    }
  };

  const isAdmin = isAdminAddress(walletAddress);

  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Overview',
      icon: LayoutDashboard,
      description: 'VAT dashboard'
    },
    {
      id: 'vat-refund',
      label: 'VAT Refund',
      icon: Receipt,
      description: 'Submit a refund claim'
    },
    ...(isAdmin ? [{
      id: 'vat-admin',
      label: 'VAT Admin',
      icon: Shield,
      description: 'Admin panel'
    }] : []),
    {
      id: 'ai-assistant',
      label: 'AI Assistant',
      icon: Bot,
      description: 'VAT & Stellar help',
      children: [
        {
          id: 'ai-assistant-chat',
          label: 'New Chat',
          icon: MessageSquare,
          description: 'Start new conversation'
        },
        {
          id: 'ai-assistant-history',
          label: 'Chat History',
          icon: History,
          description: 'View past conversations'
        }
      ]
    }
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      setActiveTab('landing');
      setShowAccountMenu(false);
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const handleDisconnectWallet = () => {
    try {
      disconnect();
      setShowAccountMenu(false);
      setActiveTab('landing');
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  const handleCopyAddress = async () => {
    if (walletAddress) {
      try {
        await navigator.clipboard.writeText(walletAddress);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } catch (error) {
        console.error('Failed to copy address:', error);
      }
    }
  };

  const handleNavItemClick = (itemId: string, event?: React.MouseEvent<HTMLButtonElement>) => {
    if (itemId === 'ai-assistant') {
      if (isMobile && !shouldShowExpanded && event) {
        const buttonRect = event.currentTarget.getBoundingClientRect();
        setMobileDropdownModal({ 
          isOpen: true, 
          type: 'ai-assistant',
          buttonRect 
        });
      } else {
        setShowAIAssistantDropdown(!showAIAssistantDropdown);
      }
    } else {
      setActiveTab(itemId);
      if (isMobile) setIsMobileOpen(false);
    }
  };

  const handleChildNavItemClick = (childId: string) => {
    setActiveTab(childId);
    if (isMobile) setIsMobileOpen(false);
  };

  const handleMobileDropdownSelect = (childId: string) => {
    setActiveTab(childId);
    setMobileDropdownModal({ isOpen: false, type: null });
    setIsMobileOpen(false);
  };

  const isAIAssistantActive = activeTab === 'ai-assistant-chat' || activeTab === 'ai-assistant-history';
  const shouldShowExpanded = isMobile ? isMobileOpen : !isCollapsed;

  const getCurrentDropdownItems = () => {
    if (mobileDropdownModal.type === 'ai-assistant') {
      return navigationItems.find(item => item.id === 'ai-assistant')?.children || [];
    }
    return [];
  };

  return (
    <>
      {isMobile && isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <AnimatePresence>
        {mobileDropdownModal.isOpen && mobileDropdownModal.buttonRect && (
          <>
            <div 
              className="fixed inset-0 z-50"
              onClick={() => setMobileDropdownModal({ isOpen: false, type: null })}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl"
              style={{
                left: mobileDropdownModal.buttonRect.right + 8,
                top: mobileDropdownModal.buttonRect.top,
                minWidth: '200px'
              }}
            >
              <div className="p-2">
                <div className="text-xs font-medium text-gray-500 px-3 py-2">AI Assistant</div>
                <div className="space-y-1">
                  {getCurrentDropdownItems().map((child) => (
                    <button
                      key={child.id}
                      onClick={() => handleMobileDropdownSelect(child.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                        activeTab === child.id
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <child.icon className="w-4 h-4" />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{child.label}</div>
                        <div className="text-xs text-gray-500">{child.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 ${
        isMobile ? (isMobileOpen ? 'w-64' : 'w-16') : (isCollapsed ? 'w-16' : 'w-64')
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              {shouldShowExpanded && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setActiveTab('landing')}
                  className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <h1 className="text-xl font-bold text-gray-900">⚡ Gemetra</h1>
                </motion.button>
              )}
              <button
                onClick={toggleCollapse}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
              >
                {shouldShowExpanded ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-2">
              {navigationItems.map((item) => (
                <div key={item.id}>
                  <button
                    onClick={(e) => handleNavItemClick(item.id, e)}
                    className={`w-full flex items-center space-x-3 rounded-lg transition-all duration-200 group ${
                      shouldShowExpanded ? 'px-3 py-3' : 'px-2 py-1 justify-center'
                    } ${
                      (activeTab === item.id || (item.id === 'ai-assistant' && isAIAssistantActive))
                        ? 'bg-gray-100 text-black shadow-sm'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className={shouldShowExpanded ? 'w-5 h-5' : 'w-6 h-6'} />
                    {shouldShowExpanded && (
                      <>
                        <div className="flex-1 text-left">
                          <div className="font-medium">{item.label}</div>
                        </div>
                        {item.children && (
                          <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${
                            item.id === 'ai-assistant' && showAIAssistantDropdown ? 'rotate-180' : ''
                          }`} />
                        )}
                      </>
                    )}
                  </button>

                  {item.children && shouldShowExpanded && (
                    <AnimatePresence>
                      {item.id === 'ai-assistant' && showAIAssistantDropdown && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="ml-6 mt-2 space-y-1"
                        >
                          {item.children.map((child) => (
                            <button
                              key={child.id}
                              onClick={() => handleChildNavItemClick(child.id)}
                              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                                activeTab === child.id
                                  ? 'bg-gray-200 text-gray-900'
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                              }`}
                            >
                              <child.icon className="w-4 h-4" />
                              <div className="flex-1 text-left">
                                <div className="text-sm font-medium">{child.label}</div>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              ))}
            </div>
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => {
                setActiveTab('settings');
                if (isMobile) setIsMobileOpen(false);
              }}
              className={`w-full flex items-center rounded-lg transition-all duration-200 group ${
                shouldShowExpanded ? 'space-x-3 px-3 py-3' : 'px-2 py-1 justify-center'
              } ${activeTab === 'settings' ? 'text-black' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}`}
            >
              <Settings className={shouldShowExpanded ? 'w-5 h-5' : 'w-6 h-6'} />
              {shouldShowExpanded && (
                <div className="flex-1 text-left">
                  <div className="font-medium">Settings</div>
                </div>
              )}
            </button>
          </div>

          <div className="p-4 border-t border-gray-200 bg-gray-50">
            {isWalletConnected ? (
              <div className="relative">
                <button
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className={`w-full flex items-center rounded-lg transition-all duration-200 hover:bg-white hover:shadow-sm ${
                    shouldShowExpanded 
                      ? 'space-x-3 bg-white border border-gray-200 px-4 py-3' 
                      : 'justify-center bg-white border border-gray-200 px-2 py-2'
                  }`}
                >
                  <div className="relative">
                    <div className={`${shouldShowExpanded ? 'w-10 h-10' : 'w-12 h-12'} rounded-lg overflow-hidden shadow-sm border-2 border-gray-200`}>
                      <img
                        src={`https://noun.pics/${walletAddress ? parseInt(walletAddress.slice(2, 10), 16) % 1000 : 1}.svg`}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${walletAddress || 'default'}`;
                        }}
                      />
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 ${shouldShowExpanded ? 'w-3 h-3' : 'w-4 h-4'} bg-green-500 border-2 border-white rounded-full`} />
                  </div>
                  {shouldShowExpanded && (
                    <>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{companyName || 'My Company'}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Wallet className="w-3 h-3 text-green-600 flex-shrink-0" />
                          <div className="text-xs text-gray-600 font-mono truncate">
                            {formatStellarAddress(walletAddress)}
                          </div>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>

                <AnimatePresence>
                  {showAccountMenu && shouldShowExpanded && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50"
                    >
                      <div className="p-4 bg-gradient-to-br from-gray-50 to-white border-b border-gray-200">
                        <div className="bg-white rounded-lg border border-gray-200 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-brand-600" />
                              <span className="text-xs font-medium text-gray-700">Wallet Address</span>
                            </div>
                            <button onClick={handleCopyAddress} className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Copy address">
                              {copiedAddress ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                            </button>
                          </div>
                          <div className="text-xs font-mono text-gray-900 break-all bg-gray-50 px-2 py-1.5 rounded">{walletAddress}</div>
                        </div>
                      </div>
                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => { setActiveTab('settings'); setShowAccountMenu(false); }}
                          className="w-full flex items-center space-x-2 px-3 py-2.5 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-sm"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Settings</span>
                        </button>
                        <button
                          onClick={handleDisconnectWallet}
                          className="w-full flex items-center space-x-2 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Disconnect Wallet</span>
                        </button>
                        {user && (
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center space-x-2 px-3 py-2.5 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-sm border-t border-gray-100 mt-1 pt-2"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="space-y-3">
                <ConnectButton />
                {user && (
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm border border-gray-200"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAccountMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowAccountMenu(false)} />
      )}
    </>
  );
};
