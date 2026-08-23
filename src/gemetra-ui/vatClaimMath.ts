/**
 * Tourist VAT / GST claim math — currencies + country-specific calculation rules.
 *
 * Assumptions (aligned with Global Blue / government TRS docs):
 * - Retail receipts show tax-inclusive totals unless noted (EU, UAE, SG, JP, etc.).
 * - "Net refund %" is applied to the tax-inclusive purchase total (after operator fees).
 * - Exceptions: AU TRS refunds full GST component; VN refunds 85% of VAT paid.
 */

import type { VatCountry } from './vatCountries';
import { parseRefundRatePercent, parseVatRatePercent } from './vatCountries';

export type PricingBasis = 'tax_inclusive' | 'tax_exclusive';
export type RefundMethod = 'net_of_gross' | 'percent_of_vat' | 'full_tax_component';

export interface CountryClaimMeta {
  currency: string;
  currencySymbol: string;
  pricingBasis: PricingBasis;
  refundMethod: RefundMethod;
  /** Override when vatRate is a range (e.g. TR 10–20% → use 20% standard retail). */
  standardVatPercent?: number;
  /** Fraction of VAT component returned (VN = 0.85). */
  vatRefundShare?: number;
}

/** ISO 4217 + display symbol per destination. */
export const COUNTRY_CLAIM_META: Record<string, CountryClaimMeta> = {
  AE: { currency: 'AED', currencySymbol: 'AED', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  FR: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  IT: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  ES: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  DE: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  JP: { currency: 'JPY', currencySymbol: '¥', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  SG: { currency: 'SGD', currencySymbol: 'S$', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  CH: { currency: 'CHF', currencySymbol: 'CHF', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross', standardVatPercent: 8.1 },
  KR: { currency: 'KRW', currencySymbol: '₩', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  NL: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  AT: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  BE: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  PT: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  SA: { currency: 'SAR', currencySymbol: 'SAR', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  TR: { currency: 'TRY', currencySymbol: '₺', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross', standardVatPercent: 20 },
  TH: { currency: 'THB', currencySymbol: '฿', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  AU: { currency: 'AUD', currencySymbol: 'A$', pricingBasis: 'tax_inclusive', refundMethod: 'full_tax_component' },
  GR: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  IE: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  SE: { currency: 'SEK', currencySymbol: 'kr', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  DK: { currency: 'DKK', currencySymbol: 'kr', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  NO: { currency: 'NOK', currencySymbol: 'kr', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  FI: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  PL: { currency: 'PLN', currencySymbol: 'zł', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  CZ: { currency: 'CZK', currencySymbol: 'Kč', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  HU: { currency: 'HUF', currencySymbol: 'Ft', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  HR: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  SK: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  CY: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  LU: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  MT: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  IS: { currency: 'ISK', currencySymbol: 'kr', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  EE: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  LV: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  LT: { currency: 'EUR', currencySymbol: '€', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  RS: { currency: 'RSD', currencySymbol: 'RSD', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  BH: { currency: 'BHD', currencySymbol: 'BHD', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  XI: { currency: 'GBP', currencySymbol: '£', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  ID: { currency: 'IDR', currencySymbol: 'Rp', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  VN: { currency: 'VND', currencySymbol: '₫', pricingBasis: 'tax_inclusive', refundMethod: 'percent_of_vat', vatRefundShare: 0.85 },
  CN: { currency: 'CNY', currencySymbol: '¥', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross', standardVatPercent: 13 },
  EG: { currency: 'EGP', currencySymbol: 'EGP', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  MA: { currency: 'MAD', currencySymbol: 'MAD', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  ZA: { currency: 'ZAR', currencySymbol: 'R', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  LB: { currency: 'USD', currencySymbol: '$', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  AR: { currency: 'ARS', currencySymbol: 'ARS', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  BS: { currency: 'BSD', currencySymbol: '$', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  CO: { currency: 'COP', currencySymbol: 'COP', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  PE: { currency: 'PEN', currencySymbol: 'S/', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
  UY: { currency: 'UYU', currencySymbol: '$U', pricingBasis: 'tax_inclusive', refundMethod: 'net_of_gross' },
};

const DEFAULT_META: CountryClaimMeta = {
  currency: 'USD',
  currencySymbol: '$',
  pricingBasis: 'tax_inclusive',
  refundMethod: 'net_of_gross',
};

export function getCountryClaimMeta(code: string): CountryClaimMeta {
  return COUNTRY_CLAIM_META[code] ?? DEFAULT_META;
}

export function effectiveVatRatePercent(country: VatCountry, meta: CountryClaimMeta): number {
  if (meta.standardVatPercent != null) return meta.standardVatPercent;
  return parseVatRatePercent(country.vatRate);
}

/** VAT/GST component extracted from the receipt total. */
export function extractTaxComponent(
  billAmount: number,
  vatRatePercent: number,
  pricingBasis: PricingBasis
): number {
  if (billAmount <= 0 || vatRatePercent <= 0) return 0;
  if (pricingBasis === 'tax_exclusive') {
    return (billAmount * vatRatePercent) / 100;
  }
  // Tax-inclusive: gross = net + tax, tax = gross × r / (100 + r)
  return (billAmount * vatRatePercent) / (100 + vatRatePercent);
}

export function calculateClaimAmounts(
  billAmount: number,
  country: VatCountry
): {
  vatAmount: number;
  netRefund: number;
  vatRatePercent: number;
  netRefundPercent: number;
  currency: string;
  currencySymbol: string;
  pricingBasis: PricingBasis;
  refundMethod: RefundMethod;
  calculationNote: string;
} {
  const meta = getCountryClaimMeta(country.code);
  const vatRatePercent = effectiveVatRatePercent(country, meta);
  const netRefundPercent = parseRefundRatePercent(country.refundRate);

  const vatAmount = extractTaxComponent(billAmount, vatRatePercent, meta.pricingBasis);

  let netRefund: number;
  let calculationNote: string;

  switch (meta.refundMethod) {
    case 'full_tax_component':
      netRefund = vatAmount;
      calculationNote = `Full GST/VAT component (${vatRatePercent}% of inclusive total)`;
      break;
    case 'percent_of_vat': {
      const share = meta.vatRefundShare ?? netRefundPercent / 100;
      netRefund = vatAmount * share;
      calculationNote = `${Math.round(share * 100)}% of VAT paid (government rule)`;
      break;
    }
    case 'net_of_gross':
    default:
      netRefund =
        netRefundPercent > 0 ? (billAmount * netRefundPercent) / 100 : vatAmount;
      calculationNote = `${netRefundPercent || vatRatePercent}% net of tax-inclusive total (after typical operator fees)`;
      break;
  }

  return {
    vatAmount,
    netRefund,
    vatRatePercent,
    netRefundPercent,
    currency: meta.currency,
    currencySymbol: meta.currencySymbol,
    pricingBasis: meta.pricingBasis,
    refundMethod: meta.refundMethod,
    calculationNote,
  };
}

export function formatClaimMoney(amount: number, meta: CountryClaimMeta, decimals?: number): string {
  const d =
    decimals ??
    (meta.currency === 'JPY' || meta.currency === 'KRW' || meta.currency === 'VND' || meta.currency === 'IDR'
      ? 0
      : 2);
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
  return `${meta.currencySymbol}${formatted}`;
}

export function billAmountLabel(meta: CountryClaimMeta): string {
  return meta.pricingBasis === 'tax_inclusive'
    ? `Total on receipt (incl. tax, ${meta.currency})`
    : `Total before tax (${meta.currency})`;
}
