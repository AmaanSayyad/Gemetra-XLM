import React from 'react';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const chatMarkdownComponents = {
  h1: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mb-3 mt-4 text-lg font-semibold first:mt-0" {...props} />
  ),
  h2: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0" {...props} />
  ),
  h3: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mb-2 mt-3 text-sm font-semibold first:mt-0" {...props} />
  ),
  p: ({ ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-2 leading-relaxed first:mt-0 last:mb-0" {...props} />
  ),
  strong: ({ ...props }: React.HTMLAttributes<HTMLElement>) => <strong className="font-semibold" {...props} />,
  ul: ({ ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-2 ml-4 list-disc space-y-1" {...props} />
  ),
  ol: ({ ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-2 ml-4 list-decimal space-y-1" {...props} />
  ),
  li: ({ ...props }: React.HTMLAttributes<HTMLLIElement>) => <li className="leading-relaxed" {...props} />,
  code: ({ inline, ...props }: { inline?: boolean } & React.HTMLAttributes<HTMLElement>) =>
    inline ? (
      <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[0.85em]" {...props} />
    ) : (
      <code className="my-2 block overflow-x-auto rounded-xl bg-[var(--gem-ink)] p-3 font-mono text-sm text-white" {...props} />
    ),
  a: ({ ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="font-medium text-[var(--gem-brand)] underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />
  ),
};

interface ChatMessageBubbleProps {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
  compact?: boolean;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ type, content, timestamp, compact }) => {
  const time =
    typeof timestamp === 'string'
      ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const avatarSize = compact ? 'h-7 w-7' : 'h-8 w-8';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const textSize = compact ? 'text-sm' : 'text-sm sm:text-[15px]';

  return (
    <div className={`flex ${type === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex max-w-[92%] items-start gap-2.5 sm:max-w-[85%] sm:gap-3 ${
          type === 'user' ? 'flex-row-reverse' : ''
        }`}
      >
        <div
          className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-full ${
            type === 'user' ? 'bg-[var(--gem-ink)]' : 'bg-[var(--gem-brand-soft)]'
          }`}
        >
          {type === 'user' ? (
            <User className={`${iconSize} text-white`} />
          ) : (
            <Bot className={`${iconSize} text-[var(--gem-brand)]`} />
          )}
        </div>

        <div
          className={`rounded-[20px] px-3.5 py-2.5 sm:px-4 sm:py-3 ${
            type === 'user'
              ? 'bg-[var(--gem-ink)] text-white'
              : 'border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] text-[var(--gem-text)]'
          }`}
        >
          {type === 'assistant' ? (
            <div className={`prose-gem leading-relaxed ${textSize}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className={`whitespace-pre-wrap leading-relaxed ${textSize}`}>{content}</p>
          )}
          <p
            className={`mt-1.5 text-[10px] sm:mt-2 ${
              type === 'user' ? 'text-white/45' : 'text-[var(--gem-text-muted)]'
            }`}
          >
            {time}
          </p>
        </div>
      </div>
    </div>
  );
};
