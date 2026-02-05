/**
 * Client-side Error Handler
 * 
 * Provides consistent error handling for frontend code with:
 * - Sentry error capture
 * - Toast notifications
 * - Breadcrumb logging
 */

import * as Sentry from '@sentry/nextjs';
import { toast } from '../hooks/useToast';
import { AxiosError } from 'axios';

// ============================================================================
// Types
// ============================================================================

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface CaptureErrorOptions {
  /** Show toast notification to user (default: true) */
  showToast?: boolean;
  /** Custom toast title */
  toastTitle?: string;
  /** Custom user-facing message (overrides error message) */
  userMessage?: string;
  /** Additional context for Sentry */
  context?: Record<string, unknown>;
  /** Sentry tags for filtering */
  tags?: Record<string, string>;
  /** Skip Sentry capture (useful for expected errors) */
  skipSentry?: boolean;
}

// ============================================================================
// Main Error Handler
// ============================================================================

/**
 * Captures an error and optionally shows a toast notification.
 * Use this in catch blocks throughout the frontend.
 */
export function captureClientError(
  error: unknown,
  componentName: string,
  options: CaptureErrorOptions = {}
): string {
  const {
    showToast = true,
    toastTitle = 'Error',
    userMessage,
    context,
    tags,
    skipSentry = false,
  } = options;

  // Extract error message
  const errorMessage = getErrorMessage(error);
  const displayMessage = userMessage ?? errorMessage;

  // Capture to Sentry
  if (!skipSentry) {
    Sentry.captureException(error, {
      tags: {
        component: componentName,
        ...tags,
      },
      extra: {
        ...context,
        originalMessage: errorMessage,
      },
    });
  }

  // Add breadcrumb for debugging flow
  Sentry.addBreadcrumb({
    category: 'error',
    message: `${componentName}: ${errorMessage}`,
    level: 'error',
    data: context,
  });

  // Show toast notification
  if (showToast) {
    toast.error({
      title: toastTitle,
      description: displayMessage,
    });
  }

  return displayMessage;
}

/**
 * Extract a user-friendly message from various error types.
 */
export function getErrorMessage(error: unknown): string {
  // Axios error with API response
  if (isAxiosError(error)) {
    const apiError = error.response?.data as ApiErrorResponse | undefined;
    if (apiError?.error?.message) {
      return apiError.error.message;
    }
    if (error.response?.status === 401) {
      return 'Please log in to continue';
    }
    if (error.response?.status === 403) {
      return 'You do not have permission to perform this action';
    }
    if (error.response?.status === 404) {
      return 'The requested resource was not found';
    }
    if (error.response?.status === 429) {
      return 'Too many requests. Please try again later.';
    }
    if (error.response?.status && error.response.status >= 500) {
      return 'A server error occurred. Please try again.';
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
      return 'Network error. Please check your connection.';
    }
    return error.message || 'An unexpected error occurred';
  }

  // Standard Error object
  if (error instanceof Error) {
    return error.message;
  }

  // String error
  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
}

/**
 * Type guard for Axios errors.
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (error as AxiosError)?.isAxiosError === true;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Capture an API error with appropriate handling.
 */
export function captureApiError(
  error: unknown,
  operation: string,
  options?: Omit<CaptureErrorOptions, 'tags'>
): string {
  return captureClientError(error, operation, {
    ...options,
    tags: { type: 'api_error' },
  });
}

/**
 * Capture a validation error (typically skip Sentry).
 */
export function captureValidationError(
  message: string,
  componentName: string,
  options?: Omit<CaptureErrorOptions, 'skipSentry'>
): void {
  captureClientError(new Error(message), componentName, {
    ...options,
    skipSentry: true,
    toastTitle: 'Validation Error',
    userMessage: message,
  });
}

// ============================================================================
// Breadcrumb Helpers
// ============================================================================

/**
 * Add a UI breadcrumb for debugging.
 */
export function addUIBreadcrumb(
  message: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'ui',
    message,
    level: 'info',
    data,
  });
}

/**
 * Add an action breadcrumb (user interaction).
 */
export function addActionBreadcrumb(
  action: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'user.action',
    message: action,
    level: 'info',
    data,
  });
}

/**
 * Add a navigation breadcrumb.
 */
export function addNavigationBreadcrumb(
  from: string,
  to: string
): void {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `${from} -> ${to}`,
    level: 'info',
    data: { from, to },
  });
}
