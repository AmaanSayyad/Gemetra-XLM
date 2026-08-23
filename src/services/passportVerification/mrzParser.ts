import { parseMRZ } from 'mrz-fast';
import type { MrzFields } from './types';

const MRZ_LINE_LENGTH = 44;

/** Normalize OCR noise before parsing */
function sanitizeMrzLine(line: string): string {
  return line
    .toUpperCase()
    .replace(/[^A-Z0-9<]/g, '<')
    .padEnd(MRZ_LINE_LENGTH, '<')
    .slice(0, MRZ_LINE_LENGTH);
}

/** OCR often reads `<` fillers as L, C, or I — fix before ICAO parse */
export function correctOcrMrzLine(line: string, lineNumber: 1 | 2): string {
  let s = sanitizeMrzLine(line);

  if (lineNumber === 1) {
    const head = s.slice(0, 5);
    let names = s.slice(5);
    names = names.replace(/L{2,}/g, (m) => '<'.repeat(m.length));
    names = names.replace(/C{4,}/g, (m) => '<'.repeat(m.length));
    names = names.replace(/I{4,}/g, (m) => '<'.repeat(m.length));
    names = names.replace(/K{4,}/g, (m) => '<'.repeat(m.length));
    s = head + names;
    return s;
  }

  // Line 2 — digit fields: common O→0 confusion in dates & passport number
  const chars = s.split('');
  const digitSlots = new Set([
    ...Array.from({ length: 9 }, (_, i) => i),
    10, 11, 12,
    ...Array.from({ length: 6 }, (_, i) => 13 + i),
    ...Array.from({ length: 6 }, (_, i) => 21 + i),
    ...Array.from({ length: 14 }, (_, i) => 28 + i),
  ]);
  for (const i of digitSlots) {
    if (chars[i] === 'O') chars[i] = '0';
    if (chars[i] === 'I' || chars[i] === 'L') chars[i] = '1';
  }
  return chars.join('');
}

/** Strip MRZ filler noise from name fields for display & autofill */
export function cleanMrzNameField(raw: string): string {
  if (!raw) return '';

  let s = raw.replace(/</g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

  for (const suffix of ['CYILANIC', 'CILANIC', 'ILANIC']) {
    const idx = s.indexOf(suffix);
    if (idx > 0 && idx <= 12) {
      s = s.slice(0, idx);
      break;
    }
  }

  const fillerStart = s.search(/[LCIL]{3,}/i);
  if (fillerStart > 0) {
    s = s.slice(0, fillerStart).replace(/[LCIL]+$/i, '');
  }

  s = s.replace(/([A-Z]{2,})[LCIL]{3,}$/i, '$1');
  s = s.replace(/\s+[LCIL]{3,}$/i, '');
  s = s.replace(/[LCIL]{3,}.*$/i, '');

  s = s
    .split(' ')
    .filter((token) => {
      if (token.length < 6) return true;
      const upper = token.toUpperCase();
      if (/^[LCIL]+$/.test(upper)) return false;
      const unique = new Set(upper).size;
      if (unique <= 2) return false;
      if (/(.)\1{4,}/.test(upper)) return false;
      return true;
    })
    .join(' ');

  return s.trim();
}

export function isLikelyCorruptedName(name: string): boolean {
  const cleaned = cleanMrzNameField(name);
  if (!cleaned || cleaned.length < 2) return true;
  if (/[LCIL]{4,}/i.test(name)) return true;
  const letters = name.replace(/[^A-Za-z]/g, '');
  if (letters.length > 18 && new Set(letters.toUpperCase()).size <= 4) return true;
  return false;
}

/** Extract TD3 MRZ line pair from raw OCR text */
export function extractMrzLines(rawText: string): [string, string] | null {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s/g, '').toUpperCase())
    .filter((l) => l.length >= 30);

  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = sanitizeMrzLine(lines[i]);
    const l2 = sanitizeMrzLine(lines[i + 1]);
    if (l1.startsWith('P<') && /^[A-Z0-9<]+$/.test(l2)) {
      return [l1, l2];
    }
  }

  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = sanitizeMrzLine(lines[i]);
    const l2 = sanitizeMrzLine(lines[i + 1]);
    if (l1.length === MRZ_LINE_LENGTH && l2.length === MRZ_LINE_LENGTH) {
      return [l1, l2];
    }
  }

  return null;
}

/** YYMMDD → ISO date (ICAO Doc 9303 century rules) */
export function mrzDateToIso(yymmdd: string, kind: 'birth' | 'expiry' = 'birth'): string {
  if (!yymmdd || yymmdd.length !== 6 || !/^\d{6}$/.test(yymmdd)) return '';

  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);

  if (kind === 'expiry') {
    // TD3 expiry dates are always 2000–2099 for machine-readable passports
    return `${2000 + yy}-${mm}-${dd}`;
  }

  const now = new Date();
  const currentYY = now.getFullYear() % 100;
  const century = yy > currentYY ? 1900 : 2000;
  return `${century + yy}-${mm}-${dd}`;
}

function parseMrzLinesInternal(lines: [string, string]): MrzFields | null {
  try {
    const result = parseMRZ(lines, { errorCorrection: true });
    if (!result.fields) return null;

    const f = result.fields;
    const birthRaw = f.birthDate ?? '';
    const expiryRaw = f.expirationDate ?? '';

    return {
      documentCode: f.documentCode ?? 'P',
      issuingCountry: cleanMrzNameField((f.issuingState ?? '').replace(/</g, '')),
      surname: cleanMrzNameField((f.lastName ?? '').replace(/</g, ' ')),
      givenNames: cleanMrzNameField((f.firstName ?? '').replace(/</g, ' ')),
      passportNumber: (f.documentNumber ?? '').replace(/</g, ''),
      nationality: (f.nationality ?? '').replace(/</g, ''),
      dateOfBirth: mrzDateToIso(birthRaw, 'birth'),
      sex: f.sex ?? '',
      expiryDate: mrzDateToIso(expiryRaw, 'expiry'),
      personalNumber: f.personalNumber?.replace(/</g, '') || undefined,
      rawLines: [result.lines.line1, result.lines.line2],
      checkDigitsValid: result.valid,
      corrected: result.corrected,
    };
  } catch {
    return null;
  }
}

/** Parse TD3 MRZ — tries raw OCR lines then OCR-corrected lines */
export function parsePassportMrz(lines: [string, string]): MrzFields | null {
  const attempts: [string, string][] = [
    lines,
    [correctOcrMrzLine(lines[0], 1), correctOcrMrzLine(lines[1], 2)],
    [correctOcrMrzLine(lines[0], 1), lines[1]],
    [lines[0], correctOcrMrzLine(lines[1], 2)],
  ];

  let best: MrzFields | null = null;
  for (const attempt of attempts) {
    const parsed = parseMrzLinesInternal(attempt);
    if (!parsed) continue;
    if (parsed.checkDigitsValid) return parsed;
    if (!best || parsed.corrected === false) best = parsed;
  }

  return best;
}

export function isPassportExpired(expiryDateIso: string): boolean {
  if (!expiryDateIso) return false;
  const expiry = new Date(expiryDateIso);
  if (Number.isNaN(expiry.getTime())) return false;
  expiry.setHours(23, 59, 59, 999);
  return expiry < new Date();
}
