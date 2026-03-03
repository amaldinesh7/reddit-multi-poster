import React, { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { mutate } from 'swr';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { SWR_KEYS } from '@/lib/swr';

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_DURATION_MS = 30_000;

/**
 * Poll /api/me until entitlement === 'paid', or auto-resolve after timeout.
 * Payment already succeeded on Dodo's side — the poll just waits for the
 * webhook to propagate so we can pre-warm the SWR cache before navigation.
 */
const usePaymentConfirmation = () => {
  const [ready, setReady] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (cancelled) return;

      if (Date.now() - startRef.current > MAX_POLL_DURATION_MS) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const { data } = await axios.get('/api/me');
        if (data?.entitlement === 'paid') {
          if (!cancelled) {
            mutate(SWR_KEYS.AUTH, data, { revalidate: false });
            setReady(true);
          }
          return;
        }
      } catch {
        // Transient error — keep polling
      }

      if (!cancelled) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return ready;
};

export default function CheckoutSuccess() {
  const router = useRouter();
  const ready = usePaymentConfirmation();
  const [navigating, setNavigating] = useState(false);

  const handleBackToApp = useCallback(async () => {
    setNavigating(true);
    try {
      const { data } = await axios.get('/api/me');
      await mutate(SWR_KEYS.AUTH, data, { revalidate: false });
    } catch {
      mutate(SWR_KEYS.AUTH);
    }
    router.push('/');
  }, [router]);

  return (
    <>
      <Head>
        <title>Thank you - Reddit Multi Poster</title>
      </Head>

      <div className="min-h-viewport bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">

          {/* ── Confirming (polling for webhook) ── */}
          {!ready && (
            <>
              <div className="flex justify-center">
                <Loader2
                  className="h-16 w-16 text-violet-500 animate-spin"
                  aria-hidden="true"
                />
              </div>
              <h1 className="text-2xl font-semibold text-white">
                Confirming your upgrade&hellip;
              </h1>
              <p className="text-zinc-400">
                This usually takes just a few seconds.
              </p>
            </>
          )}

          {/* ── Ready — user is Pro ── */}
          {ready && (
            <>
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-semibold text-white">
                You&apos;re Pro now!
              </h1>
              <p className="text-zinc-400">
                Unlimited communities, unlimited posts. No limits, ever.
              </p>
              <button
                onClick={handleBackToApp}
                disabled={navigating}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-sm font-medium text-white hover:bg-orange-600 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                tabIndex={0}
                aria-label="Go back to the app"
              >
                {navigating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading&hellip;
                  </>
                ) : (
                  <>
                    Back to app
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
