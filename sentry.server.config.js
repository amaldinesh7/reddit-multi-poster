import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment configuration
  environment: process.env.NODE_ENV || 'development',
  
  // Release tracking - matches client config
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  
  // Performance Monitoring
  // Capture 100% of transactions in development, 20% in production (server can handle more)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Filter and enrich errors before sending
  beforeSend(event, hint) {
    // Don't send errors in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
      console.log('[Sentry Server] Event captured (dev mode):', event.message || event.exception?.values?.[0]?.value);
      return null;
    }

    // Add server-specific tags
    event.tags = {
      ...event.tags,
      runtime: 'server',
      node_version: process.version,
    };

    return event;
  },

  // Debug mode
  debug: process.env.SENTRY_DEBUG === 'true',

  // Include local variables in stack traces (helpful for debugging)
  includeLocalVariables: true,

  // Automatically capture unhandled exceptions
  autoSessionTracking: false, // Not needed for server

  // Maximum breadcrumbs to keep
  maxBreadcrumbs: 100,

  // Ignore specific errors
  ignoreErrors: [
    // Expected errors
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    // Rate limiting responses (expected behavior)
    'Rate limit exceeded',
  ],

  // Integrations for server
  integrations: [
    // Capture unhandled promise rejections
    Sentry.onUnhandledRejectionIntegration({
      mode: 'warn',
    }),
  ],
});

// Helper to capture API errors with request context
export const captureApiError = (error, req, additionalContext = {}) => {
  Sentry.withScope((scope) => {
    // Add request data
    scope.setExtra('request', {
      method: req.method,
      url: req.url,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
      },
    });

    // Add any additional context
    Object.entries(additionalContext).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    Sentry.captureException(error);
  });
};

// Helper to set user context from request cookies
export const setUserFromRequest = (req) => {
  // You can extract user info from cookies/tokens here
  // For now, we'll just set a placeholder
  const userId = req.cookies?.['user_id'];
  if (userId) {
    Sentry.setUser({ id: userId });
  }
};
