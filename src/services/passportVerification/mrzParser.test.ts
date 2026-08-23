import { describe, expect, it } from 'vitest';
import {
  cleanMrzNameField,
  correctOcrMrzLine,
  extractMrzLines,
  isPassportExpired,
  mrzDateToIso,
  parsePassportMrz,
} from './mrzParser';
import { crossValidateVizAndMrz } from './crossValidate';

/** Sample TD3 MRZ (test vector — fictional passport) */
const SAMPLE_LINES: [string, string] = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
];

describe('mrzParser', () => {
  it('extracts TD3 lines from OCR text', () => {
    const raw = `P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<
L898902C36UTO7408122F1204159ZE184226B<<<<<10`;
    const lines = extractMrzLines(raw);
    expect(lines).not.toBeNull();
    expect(lines![0].startsWith('P<')).toBe(true);
    expect(lines![1].length).toBe(44);
  });

  it('parses ICAO sample passport with valid check digits', () => {
    const mrz = parsePassportMrz(SAMPLE_LINES);
    expect(mrz).not.toBeNull();
    expect(mrz!.checkDigitsValid).toBe(true);
    expect(mrz!.passportNumber).toBe('L898902C3');
    expect(mrz!.nationality).toBe('UTO');
    expect(mrz!.surname).toContain('ERIKSSON');
  });

  it('converts MRZ YYMMDD to ISO date', () => {
    expect(mrzDateToIso('740812')).toMatch(/^1974-08-12$/);
    expect(mrzDateToIso('120415')).toMatch(/^20\d\d-04-15$/);
  });

  it('uses 20xx century for expiry dates (not 19xx)', () => {
    expect(mrzDateToIso('300129', 'expiry')).toBe('2030-01-29');
    expect(mrzDateToIso('350615', 'expiry')).toBe('2035-06-15');
    expect(isPassportExpired(mrzDateToIso('300129', 'expiry'))).toBe(false);
  });

  it('cleans OCR filler from MRZ names', () => {
    expect(cleanMrzNameField('SAYYAD')).toBe('SAYYAD');
    expect(cleanMrzNameField('AMAANCYILANICLLLLLLLLLLLLLLL')).toBe('AMAAN');
    expect(cleanMrzNameField('ERIKSSON<<ANNA<MARIA<<<<<')).toBe('ERIKSSON ANNA MARIA');
  });

  it('corrects OCR L-filler to chevrons on line 1', () => {
    const noisy = 'P<INDSAYYAD<<AMAANLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL';
    const fixed = correctOcrMrzLine(noisy, 1);
    expect(fixed).toContain('AMAAN<<<<<<<<');
    expect(fixed).not.toContain('LLLLLL');
  });
});

describe('crossValidateVizAndMrz', () => {
  it('passes when VIZ matches MRZ', () => {
    const mrz = parsePassportMrz(SAMPLE_LINES)!;
    const report = crossValidateVizAndMrz(mrz, {
      surname: 'ERIKSSON',
      givenNames: 'ANNA MARIA',
      passportNumber: 'L898902C3',
      dateOfBirth: '1974-08-12',
      expiryDate: '2012-04-15',
      nationality: 'UTO',
      source: 'gemini',
    });
    expect(report.passed).toBe(true);
    expect(report.mismatches).toHaveLength(0);
  });

  it('flags passport number mismatch', () => {
    const mrz = parsePassportMrz(SAMPLE_LINES)!;
    const report = crossValidateVizAndMrz(mrz, {
      passportNumber: 'WRONG123',
      dateOfBirth: '1974-08-12',
      source: 'gemini',
    });
    expect(report.mismatches.some((m) => m.includes('passport number'))).toBe(true);
  });
});
