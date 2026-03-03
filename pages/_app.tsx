import "@/styles/globals.css";
import { useState, useEffect, useRef } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { SWRConfig } from "swr";
import { Analytics } from "@vercel/analytics/next";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { inter, fontVariables } from "@/lib/fonts";
import { swrConfig } from "@/lib/swr";
import { initPostHogClient, trackPageView, registerUtmProperties } from "@/lib/posthog";
import { captureUtmParams, storeUtmParams, getStoredUtmParams } from "@/lib/utm";

const MobileBottomNav = dynamic(() => import("@/components/layout/MobileBottomNav"), {
  ssr: false,
});

/**
 * Thin progress bar shown during page transitions.
 * Mimics the native iOS/Android top-loading indicator for an app-like feel.
 */
const RouteProgressBar = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleStart = (url: string) => {
      // Clear any existing timer to prevent race conditions
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Only show for actual navigation, not hash changes
      if (url !== router.asPath) {
        setLoading(true);
      }
    };

    const handleDone = () => {
      // Brief delay so the bar visually completes before hiding
      timerRef.current = setTimeout(() => setLoading(false), 150);
    };

    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleDone);
    router.events.on("routeChangeError", handleDone);

    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleDone);
      router.events.off("routeChangeError", handleDone);
      // Clear timer on cleanup
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [router]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5" role="progressbar" aria-label="Loading page">
      <div className="h-full bg-gradient-to-r from-orange-500 to-violet-500 animate-route-progress" />
    </div>
  );
};

/**
 * Wrapper that applies a subtle fade-in on every page mount.
 * Uses a high starting opacity (0.92) so shared elements like headers
 * don't visibly blink during client-side navigation.
 */
const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [transitionStage, setTransitionStage] = useState<"enter" | "visible">("enter");

  useEffect(() => {
    setTransitionStage("enter");

    const raf = requestAnimationFrame(() => {
      setTransitionStage("visible");
    });

    return () => cancelAnimationFrame(raf);
  }, [router.asPath]);

  return (
    <div
      style={transitionStage === "enter" ? { opacity: 0.92 } : undefined}
      className={
        transitionStage === "enter"
          ? "transition-none"
          : "opacity-100 transition-opacity duration-100 ease-out"
      }
    >
      {children}
    </div>
  );
};

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Initialize PostHog on mount
  useEffect(() => {
    initPostHogClient();
  }, []);

  // Capture UTM params from the landing URL and register as PostHog super properties.
  // Runs once — on the first render when router.query is populated.
  useEffect(() => {
    const utmFromUrl = captureUtmParams(router.query);
    if (utmFromUrl) {
      storeUtmParams(utmFromUrl);
      registerUtmProperties(utmFromUrl);
      return;
    }

    const stored = getStoredUtmParams();
    if (stored) {
      registerUtmProperties(stored);
    }
  }, [router.query]);

  // Track page views on route changes
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      trackPageView(url);
    };

    // Track initial page view
    trackPageView(router.asPath);

    // Track subsequent page views
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    const isWebView = ua.includes("wv");
    const isStandalone =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    if (isAndroid && (isWebView || isStandalone)) {
      document.documentElement.classList.add("android-webview");
    }
  }, []);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
      </Head>
      <ErrorBoundary>
        <SWRConfig value={swrConfig}>
          <AuthProvider>
            <ThemeProvider>
              <div className={`${inter.className} ${fontVariables}`} style={{ minHeight: "100vh" }}>
                <RouteProgressBar />
                <PageTransition>
                  <Component {...pageProps} />
                </PageTransition>
                <MobileBottomNav />
                <Toaster />
              </div>
            </ThemeProvider>
          </AuthProvider>
        </SWRConfig>
      </ErrorBoundary>
      <Analytics />
    </>
  );
}
