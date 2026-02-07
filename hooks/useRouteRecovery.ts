import { useEffect } from 'react';
import { useRouter } from 'next/router';
import * as Sentry from '@sentry/nextjs';

type RouteChangeError = unknown;

const RECOVERY_SESSION_KEY = 'rmp:route-recovery:last';

const getErrorMessage = (error: RouteChangeError): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
};

const isCancelledRouteChange = (error: RouteChangeError): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  if (!('cancelled' in error)) return false;
  return (error as { cancelled?: unknown }).cancelled === true;
};

const isRecoverableRouteError = (message: string, url: string): boolean => {
  const normalizedMessage = message.toLowerCase();
  if (url.startsWith('/_next/')) return true;
  if (normalizedMessage.includes('chunkloaderror')) return true;
  if (normalizedMessage.includes('loading chunk')) return true;
  if (normalizedMessage.includes('css chunk')) return true;
  if (normalizedMessage.includes('failed to fetch')) return true;
  return false;
};

const shouldAttemptRecovery = (targetUrl: string): boolean => {
  try {
    const raw = sessionStorage.getItem(RECOVERY_SESSION_KEY);
    if (!raw) return true;

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('url' in parsed) ||
      !('ts' in parsed)
    ) {
      return true;
    }

    const url = (parsed as { url?: unknown }).url;
    const ts = (parsed as { ts?: unknown }).ts;
    if (typeof url !== 'string' || typeof ts !== 'number') return true;

    const isSameTarget = url === targetUrl;
    const isRecent = Date.now() - ts < 4000;
    if (isSameTarget && isRecent) return false;
    return true;
  } catch {
    return true;
  }
};

const markRecoveryAttempt = (targetUrl: string) => {
  try {
    sessionStorage.setItem(
      RECOVERY_SESSION_KEY,
      JSON.stringify({ url: targetUrl, ts: Date.now() })
    );
  } catch {
    // ignore
  }
};

/**
 * Recovers from rare client-side navigation failures where the URL changes
 * but the UI does not, by forcing a hard navigation for known-recoverable
 * route errors (usually stale cached chunks / SW interference).
 *
 * Also unregisters stale Service Workers in development to avoid localhost
 * being controlled by a previously-installed PWA worker.
 */
export const useRouteRecovery = () => {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const unregister = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      } catch {
        // ignore
      }
    };

    unregister();
  }, []);

  useEffect(() => {
    const handleRouteChangeError = (error: RouteChangeError, url: string) => {
      if (isCancelledRouteChange(error)) return;
      if (typeof window === 'undefined') return;
      if (typeof url !== 'string' || url.length === 0) return;

      const message = getErrorMessage(error);
      if (!isRecoverableRouteError(message, url)) return;
      if (!shouldAttemptRecovery(url)) return;

      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[route-recovery] routeChangeError → hard navigating', {
          url,
          message,
        });
      }

      Sentry.addBreadcrumb({
        category: 'navigation',
        message: 'routeChangeError → hard navigate recovery',
        level: 'error',
        data: { url, message },
      });

      markRecoveryAttempt(url);
      window.location.href = url;
    };

    const handleRouteChangeComplete = () => {
      try {
        sessionStorage.removeItem(RECOVERY_SESSION_KEY);
      } catch {
        // ignore
      }
    };

    router.events.on('routeChangeError', handleRouteChangeError);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);

    return () => {
      router.events.off('routeChangeError', handleRouteChangeError);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router.events]);
};

