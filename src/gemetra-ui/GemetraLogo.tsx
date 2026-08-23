import React from 'react';

interface GemetraLogoProps {
  variant?: 'light' | 'dark';
  showTagline?: boolean;
  className?: string;
}

/** Minimal wordmark — matches Atlys lowercase bold logo */
export const GemetraLogo: React.FC<GemetraLogoProps> = ({
  variant = 'dark',
  showTagline = false,
  className = '',
}) => {
  const textColor = variant === 'light' ? 'text-white' : 'text-[var(--gem-text)]';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`text-[22px] font-bold tracking-[-0.03em] ${textColor}`}>
        gemetra
        {variant === 'light' ? null : <span className="text-[var(--gem-brand)]">✦</span>}
      </span>
      {showTagline && (
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--gem-brand)]">
          On Stellar
        </span>
      )}
    </div>
  );
};
