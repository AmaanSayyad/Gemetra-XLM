import type { Payment } from '../lib/supabase';
import { isValidStellarAddress } from './stellar';

/** True for real Gemetra VAT refunds — XLM on Stellar with a valid G... wallet. */
export function isLegitimateXlmVatRefund(
  payment: Pick<Payment, 'employee_id' | 'token' | 'user_id'>
): boolean {
  if (payment.employee_id !== 'vat-refund') return false;
  if ((payment.token || 'XLM').toUpperCase() !== 'XLM') return false;
  return isValidStellarAddress(payment.user_id);
}

export function filterLegitimateXlmVatRefunds<T extends Pick<Payment, 'employee_id' | 'token' | 'user_id'>>(
  payments: T[]
): T[] {
  return payments.filter(isLegitimateXlmVatRefund);
}
