import React, { useRef, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { countryVideo } from './atlysAssets';

interface VideoPromoBannerProps {
  countryCode: string;
  icon: LucideIcon;
  title: React.ReactNode;
  subtitle?: string;
  size?: 'lg' | 'md';
  align?: 'center' | 'left';
  className?: string;
}

/** Full-bleed country video banner with dark overlay — Atlys-style promo block */
export const VideoPromoBanner: React.FC<VideoPromoBannerProps> = ({
  countryCode,
  icon: Icon,
  title,
  subtitle,
  size = 'lg',
  align = 'center',
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, [countryCode]);

  const padding = size === 'lg' ? 'p-10 md:p-16 lg:p-20' : 'p-8 md:p-10';
  const minH = size === 'lg' ? 'min-h-[320px] md:min-h-[380px]' : 'min-h-[280px]';
  const isLeft = align === 'left';

  return (
    <div
      className={`relative overflow-hidden rounded-[32px] ${padding} ${minH} flex h-full flex-col ${
        isLeft ? 'items-start justify-end text-left' : 'items-center justify-center text-center'
      } ${className}`}
    >
      <video
        ref={videoRef}
        key={countryCode}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        src={countryVideo(countryCode)}
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/65 to-black/80"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.35)_100%)]"
      />

      <div className={`relative z-[1] max-w-2xl ${isLeft ? 'mr-auto' : ''}`}>
        <div
          className={`mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md ${
            isLeft ? '' : 'mx-auto'
          }`}
        >
          <Icon className="h-5 w-5 text-white/90" strokeWidth={1.5} />
        </div>

        <h2
          className={`gem-serif font-normal leading-tight tracking-tight text-white ${
            size === 'lg' ? 'text-3xl md:text-[2.75rem]' : 'text-2xl md:text-3xl'
          }`}
        >
          {title}
        </h2>

        {subtitle && (
          <p className={`mt-4 max-w-lg text-sm leading-relaxed text-white/70 md:text-base ${isLeft ? '' : 'mx-auto'}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
