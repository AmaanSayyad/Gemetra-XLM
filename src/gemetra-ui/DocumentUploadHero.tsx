import React from 'react';
import { passportCover } from './atlysAssets';
import { GemetraButton } from './GemetraButton';
import ConnectButton from '../utils/connect-wallet';
import { useStellarWallet } from '../utils/stellar-wallet';

interface DocumentUploadHeroProps {
  passportName?: string;
  onStartApplication?: () => void | Promise<void>;
}

/** Atlys "Only 1 document required" section */
export const DocumentUploadHero: React.FC<DocumentUploadHeroProps> = ({
  passportName = 'UAE',
  onStartApplication,
}) => {
  const { walletState, connect } = useStellarWallet();

  const handleStart = async () => {
    if (onStartApplication) {
      await onStartApplication();
      return;
    }
    if (!walletState.isConnected) {
      await connect();
    }
  };

  return (
  <section className="px-4 py-20 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-3xl text-center">
      <h2 className="gem-serif text-4xl text-[var(--gem-text)] md:text-5xl">Only 1 document required</h2>
      <div className="mt-6 flex items-center justify-center gap-6 text-sm text-[var(--gem-text-muted)]">
        <div>
          <span className="block text-2xl font-bold text-[var(--gem-text)]">03 MIN</span>
          Fastest refund time
        </div>
        <div className="h-8 w-px bg-[var(--gem-border)]" />
        <div>
          <span className="block text-2xl font-bold text-[var(--gem-text)]">07 MIN</span>
          Avg. time to submit
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-md rounded-[28px] bg-[var(--gem-surface-muted)] p-10 shadow-inner">
        <img
          src={passportCover(passportName)}
          alt="Receipt and passport"
          className="mx-auto h-48 w-auto object-contain drop-shadow-2xl"
        />
        <h3 className="mt-8 text-xl font-bold text-[var(--gem-text)]">Tax-free receipt</h3>
        <p className="mt-2 text-[var(--gem-text-muted)]">Scan or upload. We handle the rest.</p>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <ConnectButton />
        <GemetraButton variant="ghost" size="lg" onClick={() => void handleStart()}>
          Start application
        </GemetraButton>
      </div>
    </div>
  </section>
  );
};
