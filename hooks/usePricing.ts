import useSWR from 'swr';
import axios from 'axios';
import type { PricingInfo } from '@/lib/pricing';

const fetcher = async (url: string): Promise<{ pricing: PricingInfo }> => {
  const res = await axios.get<{ pricing: PricingInfo }>(url);
  return res.data;
};

export const usePricing = () => {
  const { data, error, isLoading } = useSWR('/api/pricing', fetcher, {
    revalidateOnFocus: false,
  });

  return {
    pricing: data?.pricing ?? null,
    error,
    isLoading,
  };
};

