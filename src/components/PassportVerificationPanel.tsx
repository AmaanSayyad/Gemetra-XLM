import React, { useCallback, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  Shield,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  type PassportVerificationResult,
} from '../services/passportVerification/types';

export interface PassportAutofill {
  passportNo: string;
  nationality: string;
  dob: string;
}

interface PassportVerificationPanelProps {
  onVerified: (result: PassportVerificationResult, autofill: PassportAutofill) => void;
  onSkip?: () => void;
  disabled?: boolean;
  initialResult?: PassportVerificationResult | null;
  walletAddress?: string;
}

const STATUS_CONFIG = {
  verified: {
    icon: ShieldCheck,
    label: 'Passport verified',
    className: 'border-[var(--gem-success)]/30 bg-[var(--gem-success)]/5 text-[var(--gem-success)]',
  },
  partial: {
    icon: Shield,
    label: 'Partially verified',
    className: 'border-amber-300/50 bg-amber-50 text-amber-800',
  },
  manual_review: {
    icon: AlertCircle,
    label: 'Needs review',
    className: 'border-amber-400/50 bg-amber-50 text-amber-900',
  },
  failed: {
    icon: XCircle,
    label: 'Verification failed',
    className: 'border-red-300/50 bg-red-50 text-red-800',
  },
} as const;

export const PassportVerificationPanel: React.FC<PassportVerificationPanelProps> = ({
  onVerified,
  onSkip,
  disabled = false,
  initialResult = null,
  walletAddress,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<PassportVerificationResult | null>(initialResult);

  const handleFile = useCallback(
    async (selected: File) => {
      if (!selected.type.startsWith('image/')) return;
      setFile(selected);
      setResult(null);
      setPreview(URL.createObjectURL(selected));

      setLoading(true);
      setProgress('Loading verification engine…');
      try {
        const { verifyPassport } = await import('../services/passportVerification');
        setProgress('Checking image quality…');
        setProgress('Reading MRZ (machine-readable zone)…');
        const verification = await verifyPassport(selected, { walletAddress });
        setProgress('Cross-validating fields…');
        setResult(verification);

        if (verification.mrz && ['verified', 'partial', 'manual_review'].includes(verification.status)) {
          onVerified(verification, {
            passportNo: verification.mrz.passportNumber,
            nationality: verification.mrz.nationality || verification.viz?.nationality || '',
            dob: verification.mrz.dateOfBirth,
          });
        }
      } finally {
        setLoading(false);
        setProgress('');
      }
    },
    [onVerified, walletAddress]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  };

  const statusCfg = result ? STATUS_CONFIG[result.status] : null;
  const StatusIcon = statusCfg?.icon;

  return (
    <div className="rounded-2xl border border-[var(--gem-border)] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--gem-text)]">Verify passport</h3>
          <p className="mt-1 text-sm text-[var(--gem-text-muted)]">
            Upload the bio page. We check quality, read the MRZ, validate ICAO checksums
            {import.meta.env.VITE_GEMINI_API_KEY ? ', and cross-check printed fields with AI' : ''}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--gem-brand-soft)] px-3 py-1 text-xs font-medium text-[var(--gem-brand)]">
          <Shield className="h-3.5 w-3.5" />
          ICAO MRZ
        </div>
      </div>

      <div
        className={`relative mb-4 overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
          loading
            ? 'border-[var(--gem-brand)] bg-[var(--gem-brand-soft)]/30'
            : 'border-[var(--gem-border)] bg-[var(--gem-surface)] hover:border-[var(--gem-brand)]/40'
        }`}
      >
        {preview ? (
          <div className="relative">
            <img src={preview} alt="Passport preview" className="max-h-56 w-full object-contain p-4" />
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--gem-brand)]" />
                <p className="mt-2 text-sm font-medium text-[var(--gem-text)]">{progress}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gem-brand-soft)]">
              <FileImage className="h-7 w-7 text-[var(--gem-brand)]" />
            </div>
            <p className="mb-1 font-medium text-[var(--gem-text)]">Passport bio page</p>
            <p className="mb-4 text-sm text-[var(--gem-text-muted)]">
              Full page visible — no fingers, glare, or crop
            </p>
          </div>
        )}

        {!loading && (
          <div className="flex flex-wrap justify-center gap-2 border-t border-[var(--gem-border)] bg-white/60 px-4 py-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--gem-ink)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {file ? 'Replace photo' : 'Upload passport'}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.setAttribute('capture', 'environment');
                  inputRef.current.click();
                  inputRef.current.removeAttribute('capture');
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--gem-border)] px-4 py-2 text-sm font-medium text-[var(--gem-text)] hover:bg-[var(--gem-surface)] disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              Take photo
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onInputChange}
          disabled={disabled || loading}
        />
      </div>

      {result && statusCfg && StatusIcon && (
        <div className={`mb-4 rounded-xl border p-4 ${statusCfg.className}`}>
          <div className="flex items-center gap-2 font-semibold">
            <StatusIcon className="h-5 w-5" />
            {statusCfg.label}
            <span className="ml-auto text-sm font-normal">Trust {result.trustScore}%</span>
          </div>

          {result.mrz && (
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide opacity-70">Name</dt>
                <dd className="font-medium">
                  {result.mrz.givenNames} {result.mrz.surname}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide opacity-70">Passport no.</dt>
                <dd className="font-mono font-medium">{result.mrz.passportNumber}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide opacity-70">Nationality</dt>
                <dd className="font-medium">{result.mrz.nationality}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide opacity-70">Expires</dt>
                <dd className="font-medium">{result.mrz.expiryDate}</dd>
              </div>
            </dl>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {result.mrz?.checkDigitsValid && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-xs">
                <CheckCircle2 className="h-3 w-3" /> MRZ checksums OK
              </span>
            )}
            {result.tier === 'client_gemini' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-xs">
                <CheckCircle2 className="h-3 w-3" /> AI VIZ cross-check
              </span>
            )}
            {result.tier === 'third_party' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-xs">
                <CheckCircle2 className="h-3 w-3" /> Third-party KYC
              </span>
            )}
            {result.quality.acceptable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-xs">
                <CheckCircle2 className="h-3 w-3" /> Image quality OK
              </span>
            )}
          </div>

          {(result.warnings.length > 0 || result.errors.length > 0) && (
            <ul className="mt-3 space-y-1 text-xs">
              {result.errors.map((e) => (
                <li key={e} className="flex gap-1">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {e}
                </li>
              ))}
              {result.warnings.map((w) => (
                <li key={w} className="flex gap-1 opacity-90">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {onSkip && !result && (
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-[var(--gem-text-muted)] underline hover:text-[var(--gem-text)]"
        >
          Enter passport details manually instead
        </button>
      )}
    </div>
  );
};
