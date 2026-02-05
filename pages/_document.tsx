import { Html, Head, Main, NextScript } from "next/document";

const Document = (): JSX.Element => {
  // JSON-LD structured data for SEO
  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Reddit Multi Poster",
    "description": "Post to multiple Reddit communities with a single click. Upload once, share everywhere with smart scheduling and automatic flair management.",
    "url": "https://reddit-multi-poster.vercel.app",
    "applicationCategory": "SocialNetworkingApplication",
    "operatingSystem": "Any",
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "softwareVersion": "1.0",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Free tier available with premium upgrade option"
    },
    "featureList": [
      "Post to 30+ subreddits at once",
      "Smart scheduling with 15-minute delays",
      "Automatic flair detection and selection",
      "Real-time posting queue with progress tracking",
      "Secure Reddit OAuth authentication",
      "Image and URL content support"
    ],
    "screenshot": "https://reddit-multi-poster.vercel.app/og-image.svg",
    "author": {
      "@type": "Organization",
      "name": "Reddit Multi Poster"
    },
  };

  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('reddit-multi-poster-theme');var r=t==='light'?'light':'dark';document.documentElement.classList.toggle('dark',r==='dark');})();`,
          }}
        />
        
        {/* Favicon and App Icons */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        
        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#FF4500" />
        <meta name="msapplication-TileColor" content="#FF4500" />
        <meta name="application-name" content="Reddit Multi Poster" />
        <meta name="apple-mobile-web-app-title" content="MultiPost" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* App Manifest */}
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Preload critical assets for faster initial load */}
        <link rel="preload" href="/logo.png" as="image" type="image/png" />
        
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
};

export default Document;
