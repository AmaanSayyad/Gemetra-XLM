import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that Supabase credentials are provided
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = 'Missing required Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.';
  console.error('❌', errorMessage);
  throw new Error(errorMessage);
}

// Validate URL format
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  const errorMessage = 'Invalid Supabase URL format. URL must start with https:// and contain .supabase.co';
  console.error('❌', errorMessage);
  throw new Error(errorMessage);
}

// Accept legacy JWT anon keys (eyJ...) or new publishable keys (sb_publishable_...)
const isLegacyAnonJwt = supabaseAnonKey.startsWith('eyJ');
const isPublishableKey = supabaseAnonKey.startsWith('sb_publishable_');
if (!isLegacyAnonJwt && !isPublishableKey) {
  const errorMessage =
    'Invalid Supabase anon key format. Use the anon JWT (eyJ...) or publishable key (sb_publishable_...).';
  console.error('❌', errorMessage);
  throw new Error(errorMessage);
}

console.log('✅ Supabase client initialized with:', {
  url: supabaseUrl,
  keyPrefix: supabaseAnonKey.substring(0, 20) + '...'
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface User {
  id: string;
  email: string;
  company_name: string;
  created_at: string;
  updated_at: string;
}

export interface VATRefundDetails {
  claimCountryCode?: string;
  claimCountryName?: string;
  vatRegNo?: string;
  receiptNo?: string;
  billAmount?: string;
  vatAmount?: string;
  passportNo?: string;
  flightNo?: string;
  nationality?: string;
  dob?: string;
  purchaseDate?: string;
  merchantName?: string;
  merchantAddress?: string;
  receiverWalletAddress?: string;
  /**
   * When Soroban integration is enabled, we store the on-chain `claim_id`
   * returned by `vat-refund.submit_claim` so the admin can call follow-ups
   * like `mark_paid`, `cancel_claim`, etc.
   */
  contractClaimId?: number;
  passportVerification?: {
    status?: string;
    trustScore?: number;
    tier?: string;
    verifiedAt?: string;
    mrzValid?: boolean;
  };
  adminAction?: {
    type: 'cancelled' | 'blacklisted';
    reason?: string;
    by: string;
    at: string;
  };
}

export interface Payment {
  id: string;
  employee_id: string;
  user_id: string;
  amount: number;
  token: string;
  transaction_hash?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'blacklisted';
  payment_date: string;
  created_at: string;
  vat_refund_details?: VATRefundDetails; // JSONB field for VAT refund form data
  blockchain_type: 'stellar';
  network: 'mainnet' | 'testnet'; // Network used for payment
  memo?: string; // Stellar memo field for payment notes
  ledger?: number; // Stellar ledger number where transaction was included
}

// Chat Session Interface
export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  last_message_content: string | null;
  last_message_timestamp: string | null;
  created_at: string;
  updated_at: string;
}

// Chat Message Interface
export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  type: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// Notification Interface
export interface Notification {
  id: string;
  user_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Points System Interfaces
export interface UserPoints {
  id: string;
  user_id: string;
  total_points: number;
  lifetime_points: number;
  created_at: string;
  updated_at: string;
}

export interface PointTransaction {
  id: string;
  user_id: string;
  points: number;
  transaction_type: 'earned' | 'converted' | 'expired';
  source: 'vat_refund' | 'conversion' | 'bonus';
  source_id?: string;
  description?: string;
  created_at: string;
}

export interface PointConversion {
  id: string;
  user_id: string;
  points: number;
  xlm_amount: number;
  conversion_rate: number;
  transaction_hash?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}
