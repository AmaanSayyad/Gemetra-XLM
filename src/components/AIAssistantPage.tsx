import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, History, Plus, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePayments } from '../hooks/usePayments';
import { generateAIResponse, resetAIConversationMemory, prepareConversationContext, type AIContext, type ChatHistoryMessage } from '../services/aiService';
import { useChat } from '../hooks/useChat';
import { GemetraButton } from '../gemetra-ui/GemetraButton';
import { ChatMessageBubble } from '../gemetra-ui/ChatMessageBubble';
import { AI_SUGGESTION_GROUPS, AI_WELCOME_MESSAGE, getWelcomeSuggestions } from '../gemetra-ui/aiSuggestions';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantPageProps {
  sessionId?: string | null;
  onSessionCreated?: (sessionId: string) => void;
  onOpenHistory?: () => void;
  onNewChat?: () => void;
}

export const AIAssistantPage: React.FC<AIAssistantPageProps> = ({
  sessionId: initialSessionId,
  onSessionCreated,
  onOpenHistory,
  onNewChat,
}) => {
  const { getAllPayments } = usePayments();
  const { createChatSession, getChatMessages, addChatMessage } = useChat();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingMessage, setLoadingMessage] = useState('Thinking…');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId ?? null);
  const [isMobile, setIsMobile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isWelcomeState = messages.length <= 1 && messages.every((m) => m.type === 'assistant');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const seedWelcome = useCallback(() => {
    resetAIConversationMemory();
    setMessages([
      {
        id: 'welcome',
        type: 'assistant',
        content: AI_WELCOME_MESSAGE,
        timestamp: new Date(),
      },
    ]);
    setCurrentSessionId(null);
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      if (initialSessionId) {
        setIsLoading(true);
        setLoadingMessage('Loading conversation…');
        try {
          const dbMessages = await getChatMessages(initialSessionId);
          if (dbMessages.length === 0) {
            seedWelcome();
          } else {
            const loaded = dbMessages.map((msg) => ({
              id: msg.id,
              type: msg.type,
              content: msg.content,
              timestamp: new Date(msg.created_at),
            }));
            setMessages(loaded);
            prepareConversationContext(
              loaded.map((msg) => ({ role: msg.type, content: msg.content })),
            );
          }
          setCurrentSessionId(initialSessionId);
        } catch {
          seedWelcome();
        } finally {
          setIsLoading(false);
        }
      } else {
        seedWelcome();
      }
    };

    loadMessages();
  }, [initialSessionId, getChatMessages, seedWelcome]);

  useEffect(() => {
    getAllPayments()
      .then(setPayments)
      .catch(() => setPayments([]));
  }, [getAllPayments]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [initialSessionId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [inputValue]);

  const toHistory = (msgs: Message[]): ChatHistoryMessage[] =>
    msgs.filter((m) => m.id !== 'welcome').map((m) => ({ role: m.type, content: m.content }));

  const sendMessage = async (rawContent: string) => {
    const userMessageContent = rawContent.trim();
    if (!userMessageContent || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: userMessageContent,
      timestamp: new Date(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputValue('');
    setIsLoading(true);
    setLoadingMessage('Analyzing your question…');

    let sessionToUse = currentSessionId;

    if (!sessionToUse) {
      try {
        const title =
          userMessageContent.length > 60 ? `${userMessageContent.slice(0, 60)}…` : userMessageContent;
        const newSession = await createChatSession(title, userMessageContent);
        if (newSession) {
          sessionToUse = newSession.id;
          setCurrentSessionId(newSession.id);
          onSessionCreated?.(newSession.id);
        }
      } catch {
        const errorMessage: Message = {
          id: `err-${Date.now()}`,
          type: 'assistant',
          content: 'I could not start a new conversation. Please check your wallet connection and try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }
    }

    if (sessionToUse) {
      await addChatMessage(sessionToUse, 'user', userMessageContent);
    }

    try {
      const context: AIContext = { payments, companyName: 'Gemetra' };
      setLoadingMessage('Generating answer…');
      const response = await generateAIResponse(userMessageContent, context, toHistory(nextMessages));

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (sessionToUse) {
        await addChatMessage(sessionToUse, 'assistant', response);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          type: 'assistant',
          content:
            'Something went wrong while generating a response. Please try again — I can still help with VAT refunds, Stellar, and XLM questions.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingMessage('Thinking…');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleNewChat = () => {
    seedWelcome();
    onNewChat?.();
    textareaRef.current?.focus();
  };

  const suggestions = getWelcomeSuggestions(isMobile);

  return (
    <div className="flex h-full min-h-[calc(100dvh-5rem)] flex-col">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--gem-brand-soft)] text-[var(--gem-brand)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--gem-text)]">Gemetra AI</h1>
            <p className="text-xs text-[var(--gem-text-muted)]">VAT refunds · Stellar · XLM</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenHistory && (
            <GemetraButton variant="ghost" size="sm" icon={<History className="h-4 w-4" />} onClick={onOpenHistory}>
              History
            </GemetraButton>
          )}
          <GemetraButton variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={handleNewChat}>
            New chat
          </GemetraButton>
        </div>
      </div>

      {/* Chat card */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[var(--gem-border)] bg-white shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)]">
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {isLoading && messages.length <= 1 && (
            <div className="mb-6 flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[var(--gem-brand)]" />
                <p className="text-sm text-[var(--gem-text-muted)]">{loadingMessage}</p>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5"
              >
                <ChatMessageBubble type={message.type} content={message.content} timestamp={message.timestamp} />
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && messages.length > 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gem-brand-soft)]">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--gem-brand)]" />
                </div>
                <div className="rounded-[20px] border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] px-4 py-3">
                  <p className="text-sm text-[var(--gem-text-muted)]">{loadingMessage}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Welcome suggestions */}
          {isWelcomeState && !isLoading && (
            <div className="mt-1 space-y-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--gem-text-muted)]">Try asking</p>
              {AI_SUGGESTION_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="mb-2.5 text-xs font-semibold text-[var(--gem-text)]">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.questions.slice(0, isMobile ? 2 : 3).map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => sendMessage(question)}
                        className="rounded-full border border-[var(--gem-border)] bg-white px-3.5 py-2 text-left text-xs font-medium text-[var(--gem-text)] shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 hover:border-[var(--gem-brand)]/35 hover:bg-[var(--gem-brand-soft)] hover:shadow-[0_4px_16px_-6px_rgba(0,0,0,0.12)] sm:text-sm"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Compact chips after conversation started */}
          {!isWelcomeState && !isLoading && suggestions.length > 0 && (
            <div className="mt-4 border-t border-[var(--gem-border)] pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-[var(--gem-text-muted)]">
                <MessageSquare className="h-3.5 w-3.5" />
                Follow-up ideas
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, isMobile ? 3 : 5).map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                    className="rounded-full bg-[var(--gem-surface-muted)] px-3 py-1.5 text-xs text-[var(--gem-text-muted)] transition hover:bg-[var(--gem-brand-soft)] hover:text-[var(--gem-text)]"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--gem-border)] bg-white px-4 py-4 sm:px-6">
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about VAT refunds, your claims, Stellar, or XLM…"
              rows={1}
              className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] px-4 py-3 text-sm text-[var(--gem-text)] placeholder:text-[var(--gem-text-muted)] focus:border-[var(--gem-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--gem-brand)]/15"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              aria-label="Send message"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--gem-ink)] text-white transition hover:bg-[var(--gem-ink-soft)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-[var(--gem-text-muted)] sm:text-left">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};
