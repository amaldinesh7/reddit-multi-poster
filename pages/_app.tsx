import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { inter } from "@/lib/fonts";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <ErrorBoundary>
        <ThemeProvider>
          <div className={`${inter.className} ${inter.variable}`} style={{ minHeight: "100vh" }}>
            <Component {...pageProps} />
            <Toaster />
          </div>
        </ThemeProvider>
      </ErrorBoundary>
    </>
  );
}
