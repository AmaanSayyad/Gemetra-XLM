import { describe, it, expect } from 'vitest';
import { VAT_COUNTRIES } from './vatCountries';
import {
  calculateClaimAmounts,
  COUNTRY_CLAIM_META,
  extractTaxComponent,
  effectiveVatRatePercent,
  getCountryClaimMeta,
} from './vatClaimMath';

function country(code: string) {
  const c = VAT_COUNTRIES.find((x) => x.code === code);
  if (!c) throw new Error(`Missing country ${code}`);
  return c;
}

describe('COUNTRY_CLAIM_META coverage', () => {
  it('has currency metadata for every supported country', () => {
    for (const c of VAT_COUNTRIES) {
      expect(COUNTRY_CLAIM_META[c.code], c.code).toBeDefined();
      expect(COUNTRY_CLAIM_META[c.code].currency.length).toBeGreaterThan(0);
    }
  });
});

describe('extractTaxComponent (tax-inclusive)', () => {
  it('extracts 5% VAT from AED 1,250 inclusive total', () => {
    expect(extractTaxComponent(1250, 5, 'tax_inclusive')).toBeCloseTo(59.52, 2);
  });

  it('extracts 20% VAT from €120 inclusive total', () => {
    expect(extractTaxComponent(120, 20, 'tax_inclusive')).toBeCloseTo(20, 2);
  });

  it('extracts 10% GST from A$300 inclusive total', () => {
    expect(extractTaxComponent(300, 10, 'tax_inclusive')).toBeCloseTo(27.27, 2);
  });
});

describe('calculateClaimAmounts — country-specific rules', () => {
  it('UAE: net refund ~4.3% of gross, VAT 5% embedded', () => {
    const r = calculateClaimAmounts(1250, country('AE'));
    expect(r.currency).toBe('AED');
    expect(r.vatAmount).toBeCloseTo(59.52, 2);
    expect(r.netRefund).toBeCloseTo(53.75, 2);
    expect(r.refundMethod).toBe('net_of_gross');
  });

  it('France: 20% VAT, up to 20% net refund on gross', () => {
    const r = calculateClaimAmounts(120, country('FR'));
    expect(r.currency).toBe('EUR');
    expect(r.vatAmount).toBeCloseTo(20, 2);
    expect(r.netRefund).toBeCloseTo(24, 2);
  });

  it('Vietnam: refund is 85% of VAT paid, not 8.5% of gross', () => {
    const r = calculateClaimAmounts(10_000_000, country('VN'));
    expect(r.currency).toBe('VND');
    expect(r.vatAmount).toBeCloseTo(909_091, 0);
    expect(r.netRefund).toBeCloseTo(772_727, 0);
    expect(r.refundMethod).toBe('percent_of_vat');
  });

  it('Australia: full GST component refunded (TRS)', () => {
    const r = calculateClaimAmounts(300, country('AU'));
    expect(r.currency).toBe('AUD');
    expect(r.vatAmount).toBeCloseTo(27.27, 2);
    expect(r.netRefund).toBeCloseTo(27.27, 2);
    expect(r.refundMethod).toBe('full_tax_component');
  });

  it('Türkiye: uses 20% standard VAT for range rates', () => {
    const meta = getCountryClaimMeta('TR');
    expect(effectiveVatRatePercent(country('TR'), meta)).toBe(20);
    const r = calculateClaimAmounts(1000, country('TR'));
    expect(r.vatAmount).toBeCloseTo(166.67, 2);
    expect(r.netRefund).toBeCloseTo(135, 2);
  });

  it('China: uses 13% goods VAT override', () => {
    const meta = getCountryClaimMeta('CN');
    expect(effectiveVatRatePercent(country('CN'), meta)).toBe(13);
    const r = calculateClaimAmounts(500, country('CN'));
    expect(r.vatAmount).toBeCloseTo(57.52, 2);
    expect(r.netRefund).toBeCloseTo(65, 2);
  });

  it('Switzerland: 8.1% standard rate', () => {
    const r = calculateClaimAmounts(300, country('CH'));
    expect(r.vatAmount).toBeCloseTo(22.48, 2);
    expect(r.netRefund).toBeCloseTo(24.3, 2);
  });

  it('Singapore: 9% GST, up to 8% net', () => {
    const r = calculateClaimAmounts(100, country('SG'));
    expect(r.vatAmount).toBeCloseTo(8.26, 2);
    expect(r.netRefund).toBeCloseTo(8, 2);
  });
});
