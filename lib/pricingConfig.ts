export interface PricingAmounts {
  indiaInr: number;
  usd: number;
}

const parsePositiveNumber = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
};

export const getPricingAmountsFromEnv = (): PricingAmounts => {
  return {
    indiaInr: parsePositiveNumber(process.env.RMP_PRICE_INDIA_INR, 299),
    usd: parsePositiveNumber(process.env.RMP_PRICE_USD, 9),
  };
};

