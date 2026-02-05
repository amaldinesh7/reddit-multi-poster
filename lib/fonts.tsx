import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Primary font - Inter for body text
 * Using next/font for optimal loading (self-hosted, no render blocking)
 */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Monospace font - JetBrains Mono for code/admin panels
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

/**
 * Display font - Plus Jakarta Sans for headings
 */
export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

/**
 * Combined font class names for use in _app.tsx
 */
export const fontVariables = `${inter.variable} ${jetbrainsMono.variable} ${plusJakartaSans.variable}`;
