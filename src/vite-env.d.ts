/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STELLAR_NETWORK?: 'mainnet' | 'testnet';
  readonly VITE_HORIZON_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ADMIN_PUBLIC_KEY?: string;
  readonly VITE_TREASURY_PUBLIC_KEY?: string;
  readonly VITE_ENABLE_VAT_REFUND_ONCHAIN?: string;
  readonly VITE_VAT_REFUND_CONTRACT_ID?: string;
  readonly VITE_SOROBAN_RPC_URL?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_PASSPORT_SERVER_FALLBACK?: string;
  readonly VITE_EMAILJS_PUBLIC_KEY?: string;
  readonly VITE_EMAILJS_SERVICE_ID?: string;
  readonly VITE_EMAILJS_TEMPLATE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
