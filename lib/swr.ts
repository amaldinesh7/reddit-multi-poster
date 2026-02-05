import axios from 'axios';
import type { SWRConfiguration } from 'swr';

/**
 * Default fetcher for SWR using axios
 * Automatically extracts data from axios response
 */
export const fetcher = <T>(url: string): Promise<T> => 
  axios.get<T>(url).then(res => res.data);

/**
 * Global SWR configuration
 * - Deduplication prevents multiple requests for the same data
 * - Revalidation on focus disabled for smoother UX
 * - Cache persists across navigations
 */
export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,
  revalidateIfStale: false,
  dedupingInterval: 60000, // 1 minute deduplication
  errorRetryCount: 2,
  shouldRetryOnError: (error) => {
    // Don't retry on 401/403 (auth errors)
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401 || status === 403) return false;
    }
    return true;
  },
};

/**
 * SWR cache keys for consistency across the app
 */
export const SWR_KEYS = {
  AUTH: '/api/me',
  CATEGORIES: '/api/settings/categories',
  ANALYTICS: '/api/analytics',
} as const;
