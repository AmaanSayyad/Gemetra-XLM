import type { CrossValidationReport, MrzFields, VizFields } from './types';

function normalize(s: string | undefined): string {
  return (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeDate(d: string | undefined): string {
  if (!d) return '';
  return d.slice(0, 10);
}

/** VIZ ↔ MRZ cross-check — ICAO integrity layer used by Klippa, Regula, OCR Studio */
export function crossValidateVizAndMrz(mrz: MrzFields, viz: VizFields): CrossValidationReport {
  const mismatches: string[] = [];
  const matchedFields: string[] = [];

  const checks: Array<{ label: string; mrzVal: string; vizVal: string }> = [
    { label: 'passport number', mrzVal: normalize(mrz.passportNumber), vizVal: normalize(viz.passportNumber) },
    { label: 'date of birth', mrzVal: normalizeDate(mrz.dateOfBirth), vizVal: normalizeDate(viz.dateOfBirth) },
    { label: 'expiry date', mrzVal: normalizeDate(mrz.expiryDate), vizVal: normalizeDate(viz.expiryDate) },
    { label: 'surname', mrzVal: normalize(mrz.surname), vizVal: normalize(viz.surname) },
  ];

  for (const { label, mrzVal, vizVal } of checks) {
    if (!vizVal) continue;
    if (!mrzVal) continue;
    if (mrzVal === vizVal || mrzVal.includes(vizVal) || vizVal.includes(mrzVal)) {
      matchedFields.push(label);
    } else {
      mismatches.push(`${label}: MRZ "${mrzVal}" ≠ VIZ "${vizVal}"`);
    }
  }

  // Nationality — MRZ is 3-letter code; VIZ may be full name
  if (viz.nationality) {
    const mrzNat = normalize(mrz.nationality);
    const vizNat = normalize(viz.nationality);
    if (mrzNat && vizNat && mrzNat !== vizNat && !vizNat.startsWith(mrzNat)) {
      mismatches.push(`nationality: MRZ "${mrzNat}" ≠ VIZ "${vizNat}"`);
    } else if (mrzNat && vizNat) {
      matchedFields.push('nationality');
    }
  }

  return {
    passed: mismatches.length === 0 && matchedFields.length >= 2,
    mismatches,
    matchedFields,
  };
}
