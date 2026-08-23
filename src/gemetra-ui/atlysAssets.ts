/** Atlys CDN media — used for Gemetra's Atlys-inspired visual language */
import { countryMediaCode } from './vatCountries';

const CDN = 'https://media.atlys.com';

/** Atlys passport renders use display names; some differ or are missing on CDN. */
const PASSPORT_NAME_ALIASES: Record<string, string> = {
  'United Kingdom': 'UK',
  Greece: 'greece',
  Turkey: 'Italy',
  Hungary: 'Romania',
  Bahamas: 'Colombia',
  Lebanon: 'Egypt',
  Uruguay: 'Argentina',
};

const PASSPORT_CDN = `${CDN}/b2c/SEO/Passport%20Ranking%20Tool/Passport`;

function passportCoverSlug(slug: string) {
  return `${PASSPORT_CDN}/${encodeURIComponent(slug)}-Passport.jpg`;
}

/** Last-resort thumbnail when a passport render 404s. */
export const PASSPORT_COVER_FALLBACK = passportCoverSlug('France');

export const ATLYS = {
  logo: `${CDN}/b2c/Emergency/atlys-new-logo.svg`,
  laurel: `${CDN}/image/upload/lva.gif`,
  eventIcon: `${CDN}/b2c/Home%20page/Animated%20Icons/event_icon.svg`,
  exploreIcon: `${CDN}/b2c/Home%20page/Animated%20Icons/explore_icon.svg`,
} as const;

export function countryBg(code: string, width = 400) {
  const media = countryMediaCode(code);
  return `${CDN}/w_${width}/b2c/Home%20page/country-bg-gradient/${media}.avif?q=60&v=1`;
}

export function countryFlag(code: string) {
  const media = code === 'XI' ? 'GB' : countryMediaCode(code);
  return `${CDN}/f_auto,w_100/b2c/Home%20page/flags/${media}.png?q=50`;
}

export function countryHero(code: string) {
  const media = countryMediaCode(code);
  return `${CDN}/f_auto,w_1200/b2c/Home%20page/version-3/images/${media}.avif?tr=orig`;
}

export function countryVideo(code: string) {
  const media = countryMediaCode(code);
  return `${CDN}/b2c/Home%20page/version-3/videos/${media}.mp4?tr=orig`;
}

export function passportCover(country: string) {
  const resolved = PASSPORT_NAME_ALIASES[country] ?? country;
  return passportCoverSlug(resolved);
}

export type { VatCountry } from './vatCountries';
export {
  VAT_COUNTRIES,
  ATLYS_MEDIA_CODES,
  countryMediaCode,
  parseRefundRatePercent,
  parseVatRatePercent,
  getCountryByCode,
  netRefundShort,
} from './vatCountries';

export {
  calculateClaimAmounts,
  getCountryClaimMeta,
  formatClaimMoney,
  billAmountLabel,
  COUNTRY_CLAIM_META,
} from './vatClaimMath';

export const REGIONS = ['All', 'Europe', 'Asia', 'Middle East', 'Americas', 'Africa', 'Oceania'] as const;
