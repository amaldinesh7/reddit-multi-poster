import "@/styles/globals.css";
import type { AppProps } from "next/app";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { inter } from "@/lib/fonts";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <div className={`${inter.className} ${inter.variable}`} style={{ minHeight: "100vh" }}>
          <Component {...pageProps} />
          <Toaster />
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
