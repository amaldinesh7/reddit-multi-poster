import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment configuration
  environment: process.env.NODE_ENV || 'development',
  
  // Release tracking - matches client and server config
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  
  // Performance Monitoring
  // Capture 100% of transactions in development, 20% in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Filter and enrich errors before sending
  beforeSend(event) {
    // Don't send errors in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
      console.log('[Sentry Edge] Event captured (dev mode):', event.message || event.exception?.values?.[0]?.value);
      return null;
    }

    // Add edge-specific tags
    event.tags = {
      ...event.tags,
      runtime: 'edge',
    };

    return event;
  },

  // Debug mode
  debug: process.env.SENTRY_DEBUG === 'true',
});
