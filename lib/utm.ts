/**
 * UTM parameter capture and persistence utilities.
 *
 * Extracts standard UTM params from the URL query string, stores them
 * in sessionStorage so they survive client-side navigations within
 * a single session, and exposes helpers for reading them back.
 */
import type { ParsedUrlQuery } from 'querystring';

// ============================================================================
// Types
// ============================================================================

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  initial_referrer?: string;
  referring_domain?: string;
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const STORAGE_KEY = 'rmp_utm_params';

// ============================================================================
// Extraction
// ============================================================================

/**
 * Extract UTM params from a Next.js router query object.
 * Returns null when no UTM param is present.
 */
export const captureUtmParams = (query: ParsedUrlQuery): UtmParams | null => {
  const params: UtmParams = {};
  let found = false;

  for (const key of UTM_KEYS) {
    const value = query[key];
    if (typeof value === 'string' && value.trim()) {
      params[key] = value.trim();
      found = true;
    }
  }

  if (!found) return null;

  if (typeof document !== 'undefined' && document.referrer) {
    params.initial_referrer = document.referrer;
    try {
      params.referring_domain = new URL(document.referrer).hostname;
    } catch {
      // Malformed referrer — ignore
    }
  }

  return params;
};

// ============================================================================
// Session persistence
// ============================================================================

export const storeUtmParams = (params: UtmParams): void => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch {
    // Storage full or blocked — non-critical
  }
};

export const getStoredUtmParams = (): UtmParams | null => {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UtmParams;
  } catch {
    return null;
  }
};

// ============================================================================
// Cookie helpers (for server-side attribution across the OAuth redirect)
// ============================================================================

/**
 * Serialize UTM params into a compact cookie-safe string.
 * Only includes keys that have values.
 */
export const serializeUtmForCookie = (params: UtmParams): string => {
  return JSON.stringify(params);
};

/**
 * Parse the UTM cookie value back into a UtmParams object.
 */
export const parseUtmFromCookie = (raw: string | undefined): UtmParams | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UtmParams;
  } catch {
    return null;
  }
};
