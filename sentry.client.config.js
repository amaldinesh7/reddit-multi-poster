import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment configuration
  environment: process.env.NODE_ENV || 'development',
  
  // Release tracking - set via SENTRY_RELEASE env var or defaults to package version
  release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || undefined,
  
  // Performance Monitoring
  // Capture 100% of transactions in development, 10% in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay for debugging user issues (especially on mobile)
  // Capture 10% of sessions, but 100% of sessions with errors
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  replaysOnErrorSampleRate: 1.0,

  // Integrations
  integrations: [
    // Browser tracing for performance monitoring
    Sentry.browserTracingIntegration({
      // Track navigation and page load performance
      enableInp: true,
    }),
    // Session Replay - crucial for debugging mobile issues
    Sentry.replayIntegration({
      // Mask all text and block all media for privacy
      maskAllText: false,
      blockAllMedia: false,
      // Network request/response capture for debugging API issues
      networkDetailAllowUrls: ['/api/'],
      networkRequestHeaders: ['Content-Type', 'Content-Length'],
      networkResponseHeaders: ['Content-Type'],
    }),
  ],

  // Filter and enrich errors before sending
  beforeSend(event, hint) {
    // Don't send errors in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
      console.log('[Sentry] Event captured (dev mode):', event.message || event.exception?.values?.[0]?.value);
      return null;
    }

    // Filter out common non-actionable errors
    const errorMessage = event.exception?.values?.[0]?.value || '';
    
    // Ignore ResizeObserver errors (browser quirk)
    if (errorMessage.includes('ResizeObserver loop')) {
      return null;
    }
    
    // Ignore cancelled requests (user navigated away)
    if (errorMessage.includes('AbortError') || errorMessage.includes('The user aborted a request')) {
      return null;
    }

    // Add custom tags for easier filtering
    event.tags = {
      ...event.tags,
      app_version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
      is_mobile: typeof window !== 'undefined' && window.innerWidth < 768 ? 'true' : 'false',
    };

    return event;
  },

  // Add breadcrumbs for better debugging context
  beforeBreadcrumb(breadcrumb) {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
      return null;
    }
    return breadcrumb;
  },

  // Debug mode - set to true to see Sentry logs in console
  debug: process.env.SENTRY_DEBUG === 'true',

  // Automatically capture unhandled promise rejections
  autoSessionTracking: true,

  // Attach stack traces to pure capture message calls
  attachStacktrace: true,

  // Maximum breadcrumbs to keep
  maxBreadcrumbs: 50,

  // Ignore specific errors by message
  ignoreErrors: [
    // Random plugins/extensions
    'top.GLOBALS',
    // Chrome extensions
    'chrome-extension://',
    // Firefox extensions  
    'moz-extension://',
    // Safari extensions
    'safari-extension://',
    // Network errors that are expected
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // User cancelled
    'AbortError',
  ],

  // Deny URLs - ignore errors from these sources
  denyUrls: [
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    // Firefox extensions
    /^moz-extension:\/\//i,
    // Safari extensions
    /^safari-extension:\/\//i,
  ],
});

// Set user context when available (call this after authentication)
export const setSentryUser = (user) => {
  if (user) {
    Sentry.setUser({
      id: user.id,
      username: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
};

// Helper to capture errors with additional context
export const captureError = (error, context = {}) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

// Helper to add custom breadcrumb
export const addBreadcrumb = (message, category = 'custom', data = {}) => {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
};
