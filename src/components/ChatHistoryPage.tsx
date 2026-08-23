import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  Trash2,
  Search,
  Calendar,
  Sparkles,
  Loader2,
  MessagesSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '../hooks/useChat';
import type { ChatSession as DBChatSession, ChatMessage as DBChatMessage } from '../lib/supabase';
import { GemetraButton } from '../gemetra-ui/GemetraButton';
import { ChatMessageBubble } from '../gemetra-ui/ChatMessageBubble';

interface ChatSessionDisplay extends DBChatSession {
  messageCount: number;
  messages: DBChatMessage[];
}

interface ChatHistoryPageProps {
  onSelectSession: (sessionId: string) => void;
  onBack?: () => void;
}

const GENERIC_SESSION_TITLES = ['New Chat', 'Gemetra AI Chat'];

function getSessionTitle(session: ChatSessionDisplay): string {
  if (!GENERIC_SESSION_TITLES.includes(session.title)) return session.title;
  const firstUser = session.messages.find((m) => m.type === 'user');
  if (!firstUser) return session.title;
  return firstUser.content.length > 60 ? `${firstUser.content.slice(0, 60)}…` : firstUser.content;
}

function getSessionPreview(session: ChatSessionDisplay): string {
  const lastUser = [...session.messages].reverse().find((m) => m.type === 'user');
  if (lastUser) {
    return lastUser.content.length > 120 ? `${lastUser.content.slice(0, 120)}…` : lastUser.content;
  }
  return session.last_message_content || 'No messages yet.';
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function DeleteConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md overflow-hidden rounded-[24px] border border-[var(--gem-border)] bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.25)]"
      >
        <div className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--gem-text)]">Delete conversation</h3>
              <p className="text-sm text-[var(--gem-text-muted)]">This cannot be undone</p>
            </div>
          </div>
          <p className="mb-6 text-sm leading-relaxed text-[var(--gem-text-muted)]">
            All messages in this chat will be permanently removed from your history.
          </p>
          <div className="flex gap-3">
            <GemetraButton variant="secondary" size="sm" fullWidth onClick={onCancel}>
              Cancel
            </GemetraButton>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SessionCard({
  session,
  selected,
  onSelect,
  onDelete,
}: {
  session: ChatSessionDisplay;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const title = getSessionTitle(session);
  const preview = getSessionPreview(session);
  const time = session.last_message_timestamp || session.created_at;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onSelect}
      className={`group w-full rounded-[20px] border p-4 text-left transition-all duration-200 ${
        selected
          ? 'border-[var(--gem-brand)]/30 bg-[var(--gem-brand-soft)] shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)]'
          : 'border-[var(--gem-border)] bg-white hover:border-[var(--gem-brand)]/20 hover:bg-[var(--gem-surface-muted)]'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="line-clamp-1 flex-1 text-sm font-semibold text-[var(--gem-text)]">{title}</h3>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-lg p-1.5 text-[var(--gem-text-muted)] opacity-0 transition hover:bg-white hover:text-red-600 group-hover:opacity-100"
          aria-label="Delete conversation"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-[var(--gem-text-muted)]">{preview}</p>
      <div className="flex items-center justify-between text-[11px] text-[var(--gem-text-muted)]">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatTimestamp(time)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessagesSquare className="h-3 w-3" />
          {session.messageCount}
        </span>
      </div>
    </motion.button>
  );
}

export const ChatHistoryPage: React.FC<ChatHistoryPageProps> = ({ onSelectSession, onBack }) => {
  const { chatSessions, loadingSessions, fetchChatSessions, deleteChatSession, getChatMessages } = useChat();
  const [sessionsForDisplay, setSessionsForDisplay] = useState<ChatSessionDisplay[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSessionDisplay | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const prepareSessions = async () => {
      const sessionsWithDetails: ChatSessionDisplay[] = await Promise.all(
        chatSessions.map(async (session) => {
          const messages = await getChatMessages(session.id);
          return { ...session, messageCount: messages.length, messages };
        }),
      );
      setSessionsForDisplay(sessionsWithDetails);

      if (selectedSession) {
        const updated = sessionsWithDetails.find((s) => s.id === selectedSession.id);
        setSelectedSession(updated ?? null);
      }
    };

    if (!loadingSessions) prepareSessions();
  }, [chatSessions, loadingSessions, getChatMessages]);

  const filteredSessions = sessionsForDisplay.filter((session) => {
    const title = getSessionTitle(session);
    const preview = getSessionPreview(session);
    const term = searchTerm.toLowerCase();
    return title.toLowerCase().includes(term) || preview.toLowerCase().includes(term);
  });

  const handleDeleteSession = async (sessionId: string) => {
    const success = await deleteChatSession(sessionId);
    if (success) {
      setShowDeleteConfirm(null);
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setShowMobileDetail(false);
      }
      fetchChatSessions();
    }
  };

  const handleSelectSession = async (session: DBChatSession) => {
    setLoadingMessages(true);
    try {
      const messages = await getChatMessages(session.id);
      setSelectedSession({ ...session, messageCount: messages.length, messages });
      if (isMobile) setShowMobileDetail(true);
    } catch {
      setSelectedSession(null);
    } finally {
      setLoadingMessages(false);
    }
  };

  const emptyState = (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gem-brand-soft)]">
        <MessageSquare className="h-7 w-7 text-[var(--gem-brand)]" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-[var(--gem-text)]">
        {searchTerm ? 'No matching conversations' : 'No chat history yet'}
      </h3>
      <p className="max-w-xs text-sm text-[var(--gem-text-muted)]">
        {searchTerm
          ? 'Try a different search term or start a new chat.'
          : 'Start a conversation with Gemetra AI to see your history here.'}
      </p>
      {!searchTerm && onBack && (
        <GemetraButton variant="primary" size="sm" className="mt-5" onClick={onBack}>
          Go to AI Assistant
        </GemetraButton>
      )}
    </div>
  );

  const detailPanel = selectedSession ? (
    <>
      <div className="border-b border-[var(--gem-border)] px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isMobile && (
              <button
                type="button"
                onClick={() => {
                  setShowMobileDetail(false);
                  setSelectedSession(null);
                }}
                className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All chats
              </button>
            )}
            <h2 className="truncate text-base font-semibold text-[var(--gem-text)] sm:text-lg">
              {getSessionTitle(selectedSession)}
            </h2>
            <p className="text-xs text-[var(--gem-text-muted)]">
              {selectedSession.messageCount} messages ·{' '}
              {formatTimestamp(selectedSession.last_message_timestamp || selectedSession.created_at)}
            </p>
          </div>
          <GemetraButton variant="primary" size="sm" onClick={() => onSelectSession(selectedSession.id)}>
            Continue chat
          </GemetraButton>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        {loadingMessages ? (
          <div className="flex h-full items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--gem-brand)]" />
          </div>
        ) : selectedSession.messages.length > 0 ? (
          selectedSession.messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              type={message.type}
              content={message.content}
              timestamp={message.created_at}
              compact={isMobile}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="mb-3 h-10 w-10 text-[var(--gem-text-muted)]" />
            <p className="text-sm text-[var(--gem-text-muted)]">No messages in this conversation.</p>
          </div>
        )}
      </div>
    </>
  ) : (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] border border-[var(--gem-border)] bg-[var(--gem-surface-muted)]">
        <MessageSquare className="h-8 w-8 text-[var(--gem-text-muted)]" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-[var(--gem-text)]">Select a conversation</h3>
      <p className="max-w-sm text-sm text-[var(--gem-text-muted)]">
        Choose a chat from the sidebar to preview messages, then continue where you left off.
      </p>
    </div>
  );

  if (loadingSessions) {
    return (
      <div className="flex h-full min-h-[calc(100dvh-5rem)] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[var(--gem-brand)]" />
          <p className="text-sm font-medium text-[var(--gem-text-muted)]">Loading chat history…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[calc(100dvh-5rem)] flex-col">
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--gem-border)] bg-white text-[var(--gem-text-muted)] transition hover:bg-[var(--gem-surface-muted)] hover:text-[var(--gem-text)]"
              aria-label="Back to AI Assistant"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--gem-brand-soft)] text-[var(--gem-brand)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--gem-text)]">Chat History</h1>
            <p className="text-xs text-[var(--gem-text-muted)]">
              {sessionsForDisplay.length} conversation{sessionsForDisplay.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {onBack && (
          <GemetraButton variant="secondary" size="sm" icon={<Sparkles className="h-4 w-4" />} onClick={onBack}>
            AI Assistant
          </GemetraButton>
        )}
      </div>

      {/* Main card */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-[28px] border border-[var(--gem-border)] bg-white shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)]">
        {isMobile ? (
          showMobileDetail ? (
            <div className="flex flex-1 flex-col">{detailPanel}</div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="border-b border-[var(--gem-border)] p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gem-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search conversations…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] py-2.5 pl-10 pr-4 text-sm text-[var(--gem-text)] placeholder:text-[var(--gem-text-muted)] focus:border-[var(--gem-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--gem-brand)]/15"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {filteredSessions.length > 0 ? (
                  <div className="space-y-3">
                    {filteredSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        selected={false}
                        onSelect={() => handleSelectSession(session)}
                        onDelete={() => setShowDeleteConfirm(session.id)}
                      />
                    ))}
                  </div>
                ) : (
                  emptyState
                )}
              </div>
            </div>
          )
        ) : (
          <>
            {/* Sidebar */}
            <div className="flex w-full max-w-sm flex-col border-r border-[var(--gem-border)] sm:w-[340px]">
              <div className="border-b border-[var(--gem-border)] p-4 sm:p-5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gem-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search conversations…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] py-2.5 pl-10 pr-4 text-sm text-[var(--gem-text)] placeholder:text-[var(--gem-text-muted)] focus:border-[var(--gem-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--gem-brand)]/15"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {filteredSessions.length > 0 ? (
                  <div className="space-y-3">
                    {filteredSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        selected={selectedSession?.id === session.id}
                        onSelect={() => handleSelectSession(session)}
                        onDelete={() => setShowDeleteConfirm(session.id)}
                      />
                    ))}
                  </div>
                ) : (
                  emptyState
                )}
              </div>
            </div>

            {/* Detail */}
            <div className="hidden min-w-0 flex-1 flex-col sm:flex">{detailPanel}</div>
          </>
        )}
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <DeleteConfirmModal
            onCancel={() => setShowDeleteConfirm(null)}
            onConfirm={() => handleDeleteSession(showDeleteConfirm)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
