'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { 
  Crown, 
  Check, 
  Infinity as InfinityIcon, 
  Loader2, 
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../../components/ui/button';

// Import Dodo Payments SDK types
interface CheckoutBreakdownData {
  subTotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  currency?: string;
  finalTotal?: number;
  finalTotalCurrency?: string;
}

interface CheckoutEvent {
  event_type: string;
  data?: {
    message?: CheckoutBreakdownData | { status?: string; redirect_to?: string };
  };
}

// SDK will be loaded dynamically
let DodoPayments: {
  Initialize: (options: {
    mode: 'test' | 'live';
    displayType: 'inline' | 'overlay';
    onEvent: (event: CheckoutEvent) => void;
  }) => void;
  Checkout: {
    open: (options: {
      checkoutUrl: string;
      elementId?: string;
      options?: {
        showTimer?: boolean;
        showSecurityBadge?: boolean;
        manualRedirect?: boolean;
        themeConfig?: {
          light?: Record<string, string>;
          dark?: Record<string, string>;
          radius?: string;
        };
      };
    }) => void;
    close: () => void;
    isOpen: () => boolean;
  };
} | null = null;

type CheckoutStatus = 'loading' | 'ready' | 'opening' | 'processing' | 'succeeded' | 'failed' | 'error';

export default function CheckoutPage() {
  const router = useRouter();
  const [status, setStatus] = useState<CheckoutStatus>('loading');
  const statusRef = useRef<CheckoutStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [sdkInitialized, setSdkInitialized] = useState(false);
  const initRef = useRef(false);

  // Keep statusRef in sync with status state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Default to test mode for safety - only use live mode when explicitly set
  const isDodoLiveMode = process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT === 'live_mode';

  // Initialize checkout session and SDK
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {
        // 1. Create checkout session
        const { data } = await axios.post<{ checkout_url: string; session_id?: string }>(
          '/api/checkout/create-session'
        );
        
        if (!data?.checkout_url) {
          setError('Could not create checkout session');
          setStatus('error');
          return;
        }

        setCheckoutUrl(data.checkout_url);

        // 2. Load and initialize Dodo SDK
        const sdk = await import('dodopayments-checkout');
        DodoPayments = sdk.DodoPayments;

        DodoPayments.Initialize({
          mode: isDodoLiveMode ? 'live' : 'test',
          displayType: 'overlay',
          onEvent: (event: CheckoutEvent) => {
            console.log('Dodo checkout event:', event.event_type, event);

            switch (event.event_type) {
              case 'checkout.opened':
                setStatus('opening');
                break;

              case 'checkout.form_ready':
                // Form is ready for input
                break;

              case 'checkout.pay_button_clicked':
                setStatus('processing');
                break;

              case 'checkout.closed':
                // User closed the overlay - go back to ready state
                // Use statusRef.current to get latest status (avoids stale closure)
                if (statusRef.current !== 'succeeded' && statusRef.current !== 'processing') {
                  setStatus('ready');
                }
                break;

              case 'checkout.status': {
                const statusData = event.data?.message as { status?: string };
                if (statusData?.status === 'succeeded') {
                  setStatus('succeeded');
                } else if (statusData?.status === 'failed') {
                  setStatus('failed');
                  setError('Payment failed. Please try again.');
                }
                break;
              }

              case 'checkout.redirect_requested': {
                // Handle 3DS or other redirects
                const redirectData = event.data?.message as { redirect_to?: string };
                if (redirectData?.redirect_to) {
                  window.location.href = redirectData.redirect_to;
                }
                break;
              }

              case 'checkout.error':
                console.error('Checkout error:', event.data?.message);
                setStatus('error');
                setError('An error occurred during checkout. Please try again.');
                break;

              case 'checkout.link_expired':
                setStatus('error');
                setError('Checkout session expired. Please refresh the page.');
                break;
            }
          },
        });

        setSdkInitialized(true);
        setStatus('ready');
      } catch (err) {
        console.error('Failed to initialize checkout:', err);
        if (axios.isAxiosError(err) && err.response?.data?.error === 'Already purchased') {
          router.replace('/');
          return;
        }
        setError('Failed to initialize checkout. Please try again.');
        setStatus('error');
      }
    };

    init();
  }, [router, isDodoLiveMode]);

  // Handle opening the checkout overlay
  const handlePay = useCallback(() => {
    if (!DodoPayments || !checkoutUrl || !sdkInitialized) return;

    setStatus('opening');

    DodoPayments.Checkout.open({
      checkoutUrl,
      options: {
        showTimer: true,
        showSecurityBadge: true,
        manualRedirect: true,
        themeConfig: {
          dark: {
            bgPrimary: '#0a0a0a',
            bgSecondary: '#18181b',
            borderPrimary: '#27272a',
            borderSecondary: '#3f3f46',
            textPrimary: '#fafafa',
            textSecondary: '#a1a1aa',
            buttonPrimary: '#8b5cf6',
            buttonPrimaryHover: '#7c3aed',
            buttonTextPrimary: '#ffffff',
          },
          radius: '12px',
        },
      },
    });
  }, [checkoutUrl, sdkInitialized]);

  // Handle back navigation
  const handleBack = () => {
    router.back();
  };

  // Handle success - redirect to success page
  useEffect(() => {
    if (status === 'succeeded') {
      const timer = setTimeout(() => {
        router.push('/checkout/success');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (DodoPayments?.Checkout?.isOpen?.()) {
        DodoPayments.Checkout.close();
      }
    };
  }, []);

  const benefits = [
    { text: 'Unlimited communities', icon: InfinityIcon },
    { text: 'Post to as many as you want', icon: Check },
    { text: 'No limits ever', icon: Check },
    { text: 'One-time payment', icon: Check },
  ];

  return (
    <>
      <Head>
        <title>Checkout - Reddit Multi Poster Pro</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen bg-[#0a0a0a]">
        {/* Header */}
        <header className="border-b border-zinc-800 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm">Back</span>
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-violet-500" />
              <span className="font-semibold text-white">Checkout</span>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          {/* Error State */}
          {status === 'error' && (
            <div className="max-w-md mx-auto text-center space-y-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
              </div>
              <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
              <p className="text-zinc-400">{error}</p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                >
                  Try again
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="cursor-pointer"
                >
                  Go back
                </Button>
              </div>
            </div>
          )}

          {/* Success State */}
          {status === 'succeeded' && (
            <div className="max-w-md mx-auto text-center space-y-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </div>
              <h1 className="text-xl font-semibold text-white">Payment successful!</h1>
              <p className="text-zinc-400">Redirecting you to the app...</p>
              <Loader2 className="h-6 w-6 animate-spin text-violet-500 mx-auto" />
            </div>
          )}

          {/* Loading State */}
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-zinc-400">Setting up checkout...</p>
            </div>
          )}

          {/* Ready / Opening / Processing States - Show Order Summary */}
          {(status === 'ready' || status === 'opening' || status === 'processing' || status === 'failed') && (
            <div className="space-y-8">
              {/* Failed Payment Notice */}
              {status === 'failed' && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">Payment failed</p>
                    <p className="text-sm text-red-400/70 mt-1">{error || 'Please try again with a different payment method.'}</p>
                  </div>
                </div>
              )}

              {/* Product Card */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shrink-0">
                    <Crown className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-white">
                      Reddit Multi Poster Pro
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1">
                      Lifetime access · One-time purchase
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">₹199</p>
                    <p className="text-xs text-zinc-500">incl. taxes</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-zinc-800" />

                {/* Benefits */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    What you get
                  </p>
                  <ul className="space-y-3">
                    {benefits.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20">
                          <benefit.icon className="h-3.5 w-3.5 text-violet-400" />
                        </div>
                        <span className="text-zinc-300">{benefit.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Divider */}
                <div className="border-t border-zinc-800" />

                {/* Pricing */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Subtotal</span>
                    <span className="text-zinc-300">₹199.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Tax</span>
                    <span className="text-zinc-300">Included</span>
                  </div>
                  <div className="border-t border-zinc-800 pt-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-white">Total</span>
                      <span className="text-xl font-bold text-white">₹199.00</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pay Button */}
              <Button
                onClick={handlePay}
                disabled={status === 'opening' || status === 'processing' || !sdkInitialized}
                className="w-full h-14 text-lg font-semibold bg-violet-600 hover:bg-violet-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'opening' || status === 'processing' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    {status === 'processing' ? 'Processing...' : 'Opening checkout...'}
                  </>
                ) : status === 'failed' ? (
                  'Try Again'
                ) : (
                  'Pay ₹199'
                )}
              </Button>

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-2 text-zinc-500">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-xs">
                  Secure payment powered by Dodo Payments
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
