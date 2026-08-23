import React, { useState } from 'react';
import { PASSPORT_COVER_FALLBACK, passportCover } from './atlysAssets';

interface PassportCoverImageProps {
  passportName: string;
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  draggable?: boolean;
}

/** Passport thumbnail with CDN alias resolution + France fallback on 404. */
export const PassportCoverImage: React.FC<PassportCoverImageProps> = ({
  passportName,
  alt = '',
  className,
  loading = 'lazy',
  draggable,
}) => {
  const [src, setSrc] = useState(() => passportCover(passportName));

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      draggable={draggable}
      onError={() => {
        if (src !== PASSPORT_COVER_FALLBACK) setSrc(PASSPORT_COVER_FALLBACK);
      }}
    />
  );
};
