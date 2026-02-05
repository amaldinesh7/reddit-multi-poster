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
import { AppFooter, MobileBottomNav } from "@/components/layout";
import { inter, fontVariables } from "@/lib/fonts";
import { swrConfig } from "@/lib/swr";

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
 * Keeps transitions fast (150ms) so navigation feels instant but polished.
 */
const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [transitionStage, setTransitionStage] = useState<"enter" | "visible">("enter");

  useEffect(() => {
    // Reset to enter state on route change
    setTransitionStage("enter");

    // Trigger visible on next frame so the CSS transition activates
    const raf = requestAnimationFrame(() => {
      setTransitionStage("visible");
    });

    return () => cancelAnimationFrame(raf);
  }, [router.asPath]);

  return (
    <div
      className={
        transitionStage === "enter"
          ? "opacity-0 transition-none"
          : "opacity-100 transition-opacity duration-150 ease-out"
      }
    >
      {children}
    </div>
  );
};

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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
                <AppFooter />
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
