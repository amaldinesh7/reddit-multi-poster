import type { NextApiRequest } from 'next';

export type CurrencyCode = 'INR' | 'USD';
export type PricingRegion = 'india' | 'us_canada' | 'rest_of_world';

export interface PricingInfo {
  region: PricingRegion;
  amount: number;
  currency: CurrencyCode;
  formatted: string;
}

export interface PricingAmounts {
  indiaInr: number;
  usd: number;
}

const INDIA_COUNTRY_CODE = 'IN';
const US_COUNTRY_CODE = 'US';
const CANADA_COUNTRY_CODE = 'CA';

const DEFAULT_REGION: PricingRegion = 'india';

const formatPrice = (amount: number, currency: CurrencyCode): string => {
  const formatter =
    currency === 'INR'
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 })
      : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 });

  return formatter.format(amount);
};

const normalizeCountryCode = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
};

export const getCountryCodeFromRequest = (req: NextApiRequest): string | null => {
  const vercelCountry = normalizeCountryCode(req.headers['x-vercel-ip-country']);
  if (vercelCountry) return vercelCountry;

  const cloudflareCountry = normalizeCountryCode(req.headers['cf-ipcountry']);
  if (cloudflareCountry) return cloudflareCountry;

  return null;
};

export const getPricingRegionForCountry = (countryCode: string | null): PricingRegion => {
  if (!countryCode) return DEFAULT_REGION;

  if (countryCode === INDIA_COUNTRY_CODE) return 'india';
  if (countryCode === US_COUNTRY_CODE || countryCode === CANADA_COUNTRY_CODE) return 'us_canada';

  return 'rest_of_world';
};

export const getPricingForRegion = (
  region: PricingRegion,
  amounts: PricingAmounts = { indiaInr: 299, usd: 9 }
): PricingInfo => {
  if (region === 'india') {
    const amount = amounts.indiaInr;
    const currency: CurrencyCode = 'INR';
    return { region, amount, currency, formatted: formatPrice(amount, currency) };
  }

  if (region === 'us_canada') {
    const amount = amounts.usd;
    const currency: CurrencyCode = 'USD';
    return { region, amount, currency, formatted: formatPrice(amount, currency) };
  }

  // Keep ROW aligned with US/CA for now (simple global pricing).
  const amount = amounts.usd;
  const currency: CurrencyCode = 'USD';
  return { region, amount, currency, formatted: formatPrice(amount, currency) };
};

export const getPricingForRequest = (
  req: NextApiRequest,
  amounts: PricingAmounts = { indiaInr: 299, usd: 9 }
): PricingInfo => {
  const countryCode = getCountryCodeFromRequest(req);
  const region = getPricingRegionForCountry(countryCode);
  return getPricingForRegion(region, amounts);
};

