import { Wallet } from 'lucide-react';
import { useStellarWallet } from '../utils/stellar-wallet';
import { formatStellarAddress } from '../utils/stellar';
import { GemetraButton } from '../gemetra-ui';

interface ConnectButtonProps {
  variant?: 'default' | 'minimal';
}

export default function ConnectButton({ variant = 'default' }: ConnectButtonProps) {
  const { walletState, disconnect, connect } = useStellarWallet();

  if (walletState.isConnected && walletState.publicKey) {
    if (variant === 'minimal') {
      return (
        <button
          type="button"
          onClick={() => disconnect()}
          className="hidden rounded-full bg-[var(--gem-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--gem-text)] sm:block"
        >
          {formatStellarAddress(walletState.publicKey)}
        </button>
      );
    }
    return (
      <GemetraButton variant="secondary" size="sm" icon={<Wallet className="h-4 w-4" />} onClick={() => disconnect()}>
        {formatStellarAddress(walletState.publicKey)}
      </GemetraButton>
    );
  }

  if (variant === 'minimal') {
    return (
      <button
        type="button"
        onClick={() => connect()}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gem-surface-muted)] hover:bg-[var(--gem-border)]"
        aria-label="Connect wallet"
      >
        <Wallet className="h-4 w-4 text-[var(--gem-text)]" />
      </button>
    );
  }

  return (
    <GemetraButton variant="primary" size="sm" icon={<Wallet className="h-4 w-4" />} onClick={() => connect()}>
      Connect Wallet
    </GemetraButton>
  );
}
