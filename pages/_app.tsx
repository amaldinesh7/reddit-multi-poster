import "@/styles/globals.css";
import { useState, useEffect, useRef } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { SWRConfig } from "swr";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { MobileBottomNav } from "@/components/layout";
import { inter, fontVariables } from "@/lib/fonts";
import { swrConfig } from "@/lib/swr";

/**
 * Thin progress bar shown during client-side page transitions.
 * Always shows on routeChangeStart; hides on complete or error.
 */
const RouteProgressBar = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleStart = () => {
      clearTimer();
      setLoading(true);
    };

    const handleDone = () => {
      // Brief delay so the bar visually completes before hiding
      timerRef.current = setTimeout(() => setLoading(false), 150);
    };

    const handleError = (err: unknown, url: string) => {
      // When a page chunk fails to load (commonly due to stale SW/PWA caches),
      // Next.js may update the URL but keep the previous page rendered.
      // Force a full navigation to the target URL to recover.
      const message = err instanceof Error ? err.message : String(err);
      const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name?: unknown }).name) : '';
      const isChunkLoadError =
        name === 'ChunkLoadError' ||
        /ChunkLoadError|Loading chunk .* failed|CSS chunk load failed/i.test(message);

      if (isChunkLoadError && typeof window !== 'undefined') {
        window.location.href = url;
        return;
      }

      handleDone();
    };

    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleDone);
    router.events.on("routeChangeError", handleError);

    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleDone);
      router.events.off("routeChangeError", handleError);
      clearTimer();
    };
  }, [router.events]);

  if (!loading) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-0.5"
      role="progressbar"
      aria-label="Loading page"
    >
      <div className="h-full bg-gradient-to-r from-orange-500 to-violet-500 animate-route-progress" />
    </div>
  );
};

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // #region agent log
  useEffect(() => { fetch('http://127.0.0.1:7245/ingest/d1dd910a-8a0d-4999-8cd8-1087cab3ca13',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'_app.tsx:render',message:'App render',data:{componentName:Component.displayName||Component.name||'Unknown',pathname:typeof window!=='undefined'?window.location.pathname:'ssr',routerPathname:router.pathname},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{}); });
  // #endregion

  // Detect Android WebView / standalone PWA for CSS adjustments
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

  // Unregister stale service workers in development to prevent cached
  // page chunks from interfering with client-side navigation.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
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
                <Component key={router.pathname} {...pageProps} />
                <MobileBottomNav />
                <Toaster />
              </div>
            </ThemeProvider>
          </AuthProvider>
        </SWRConfig>
      </ErrorBoundary>
    </>
  );
}
