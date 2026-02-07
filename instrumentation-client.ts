// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const initClientSentry = () => {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Environment configuration
    environment: process.env.NODE_ENV || "development",

    // Release tracking
    release:
      process.env.SENTRY_RELEASE ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
      undefined,

    // Performance Monitoring - 100% in dev, 10% in prod
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session Replay - 10% of sessions, 100% of sessions with errors
    replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration({
        enableInp: true,
      }),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
        networkDetailAllowUrls: ["/api/"],
        networkRequestHeaders: ["Content-Type", "Content-Length"],
        networkResponseHeaders: ["Content-Type"],
      }),
    ],

    // Filter and enrich errors before sending
    beforeSend(event) {
      // Don't send errors in development unless explicitly enabled
      if (process.env.NODE_ENV === "development" && !process.env.SENTRY_DEBUG) {
        console.log(
          "[Sentry] Event captured (dev mode):",
          event.message || event.exception?.values?.[0]?.value
        );
        return null;
      }

      // Filter out common non-actionable errors
      const errorMessage = event.exception?.values?.[0]?.value || "";

      // Ignore ResizeObserver errors (browser quirk)
      if (errorMessage.includes("ResizeObserver loop")) {
        return null;
      }

      // Ignore cancelled requests (user navigated away)
      if (
        errorMessage.includes("AbortError") ||
        errorMessage.includes("The user aborted a request")
      ) {
        return null;
      }

      // Add custom tags for easier filtering
      event.tags = {
        ...event.tags,
        app_version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
        is_mobile:
          typeof window !== "undefined" && window.innerWidth < 768
            ? "true"
            : "false",
      };

      return event;
    },

    // Add breadcrumbs for better debugging context
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "console" && breadcrumb.level === "log") {
        return null;
      }
      return breadcrumb;
    },

    // Debug mode
    debug: process.env.SENTRY_DEBUG === "true",

    // Session tracking (Note: autoSessionTracking removed as it's no longer supported)
    attachStacktrace: true,
    maxBreadcrumbs: 50,

    // Ignore specific errors
    ignoreErrors: [
      "top.GLOBALS",
      "chrome-extension://",
      "moz-extension://",
      "safari-extension://",
      "Network request failed",
      "Failed to fetch",
      "Load failed",
      "AbortError",
    ],

    // Deny URLs
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /^safari-extension:\/\//i,
    ],

    // Enable PII for better debugging
    sendDefaultPii: true,
  });
};

if (typeof window !== "undefined") {
  const idleInit = () => {
    initClientSentry();
  };
  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout?: number }) => void }).requestIdleCallback(idleInit, { timeout: 2000 });
  } else {
    setTimeout(idleInit, 500);
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Helper: Set user context after authentication
export const setSentryUser = (user: { id: string; name?: string } | null) => {
  if (user) {
    Sentry.setUser({
      id: user.id,
      username: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
};

// Helper: Capture errors with additional context
export const captureError = (error: Error, context: Record<string, unknown> = {}) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

// Helper: Add custom breadcrumb
export const addBreadcrumb = (
  message: string,
  category = "custom",
  data: Record<string, unknown> = {}
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
  });
};
