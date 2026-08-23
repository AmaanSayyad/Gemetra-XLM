import React from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'lime';

interface GemetraButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--gem-ink)] text-white hover:bg-[var(--gem-ink-soft)]',
  secondary: 'bg-white text-[var(--gem-text)] border border-[var(--gem-border)] hover:bg-[var(--gem-surface-muted)]',
  ghost: 'bg-transparent text-[var(--gem-text)] border border-[var(--gem-border)] hover:bg-[var(--gem-surface-muted)]',
  dark: 'bg-[var(--gem-ink)] text-white hover:bg-[var(--gem-ink-soft)]',
  lime: 'bg-[var(--gem-lime)] text-[var(--gem-ink)] hover:brightness-95 font-semibold',
};

const sizes: Record<string, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
};

export const GemetraButton: React.FC<GemetraButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth,
  className,
  children,
  ...props
}) => (
  <button
    className={clsx(
      'gem-sans inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
      variants[variant],
      sizes[size],
      fullWidth && 'w-full',
      className
    )}
    {...props}
  >
    {icon}
    {children}
  </button>
);
