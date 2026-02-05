/**
 * Centralized API Error Handler
 * 
 * Provides consistent error handling, logging, and response formatting
 * for all API routes. Integrates with Sentry for error tracking.
 */

import * as Sentry from '@sentry/nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';

// ============================================================================
// Types
// ============================================================================

export type ApiErrorCode =
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'DATABASE_ERROR'
  | 'REDDIT_API_ERROR';

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

interface HandleApiErrorOptions {
  /** HTTP status code (default: 500) */
  statusCode?: number;
  /** Error code for categorization */
  errorCode?: ApiErrorCode;
  /** User-friendly message (defaults to error.message) */
  userMessage?: string;
  /** Additional context for Sentry */
  context?: Record<string, unknown>;
  /** Skip Sentry capture (useful for expected errors like validation) */
  skipSentry?: boolean;
  /** Sentry severity level */
  level?: 'fatal' | 'error' | 'warning' | 'info';
}

// ============================================================================
// Main Error Handler
// ============================================================================

/**
 * Handles API errors consistently across all routes.
 * - Captures error to Sentry with full context
 * - Adds breadcrumb for debugging
 * - Returns standardized error response
 */
export function handleApiError(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>,
  error: unknown,
  options: HandleApiErrorOptions = {}
): void {
  const {
    statusCode = 500,
    errorCode = 'INTERNAL_ERROR',
    userMessage,
    context,
    skipSentry = false,
    level = 'error',
  } = options;

  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
  const displayMessage = userMessage ?? errorMessage;

  // Extract user ID from request if available (set by auth middleware)
  const userId = (req as NextApiRequest & { userId?: string }).userId;

  // Capture to Sentry unless explicitly skipped
  if (!skipSentry) {
    Sentry.withScope((scope) => {
      // Set tags for filtering in Sentry
      scope.setTags({
        endpoint: req.url ?? 'unknown',
        method: req.method ?? 'unknown',
        statusCode: statusCode.toString(),
        errorCode,
      });

      // Set user context if available
      if (userId) {
        scope.setUser({ id: userId });
      }

      // Add request context
      scope.setContext('request', {
        url: req.url,
        method: req.method,
        query: req.query,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
        },
      });

      // Add custom context if provided
      if (context) {
        scope.setContext('custom', context);
      }

      // Set level
      scope.setLevel(level);

      // Capture the exception
      Sentry.captureException(error);
    });
  }

  // Add breadcrumb for debugging flow
  Sentry.addBreadcrumb({
    category: 'api.error',
    message: `${req.method} ${req.url} - ${statusCode} ${errorCode}`,
    level: 'error',
    data: {
      errorCode,
      message: displayMessage,
      statusCode,
    },
  });

  // Return standardized error response
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: displayMessage,
    },
  };

  res.status(statusCode).json(response);
}

// ============================================================================
// Success Response Helper
// ============================================================================

/**
 * Returns a standardized success response.
 */
export function sendSuccess<T>(
  res: NextApiResponse<ApiSuccessResponse<T>>,
  data: T,
  statusCode = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

// ============================================================================
// Convenience Error Handlers
// ============================================================================

/**
 * Handle validation errors (400)
 */
export function handleValidationError(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>,
  message: string,
  details?: unknown
): void {
  handleApiError(req, res, new Error(message), {
    statusCode: 400,
    errorCode: 'VALIDATION_ERROR',
    userMessage: message,
    context: details ? { details } : undefined,
    skipSentry: true, // Validation errors are expected
    level: 'warning',
  });
}

/**
 * Handle authentication errors (401)
 */
export function handleAuthError(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>,
  message = 'Authentication required'
): void {
  handleApiError(req, res, new Error(message), {
    statusCode: 401,
    errorCode: 'AUTH_ERROR',
    userMessage: message,
    skipSentry: true, // Auth errors are expected
    level: 'warning',
  });
}

/**
 * Handle forbidden errors (403)
 */
export function handleForbiddenError(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>,
  message = 'Access denied'
): void {
  handleApiError(req, res, new Error(message), {
    statusCode: 403,
    errorCode: 'FORBIDDEN',
    userMessage: message,
    skipSentry: true,
    level: 'warning',
  });
}

/**
 * Handle not found errors (404)
 */
export function handleNotFoundError(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>,
  resource = 'Resource'
): void {
  handleApiError(req, res, new Error(`${resource} not found`), {
    statusCode: 404,
    errorCode: 'NOT_FOUND',
    userMessage: `${resource} not found`,
    skipSentry: true,
    level: 'info',
  });
}

/**
 * Handle rate limit errors (429)
 */
export function handleRateLimitError(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>,
  message = 'Too many requests. Please try again later.'
): void {
  handleApiError(req, res, new Error(message), {
    statusCode: 429,
    errorCode: 'RATE_LIMITED',
    userMessage: message,
    skipSentry: true,
    level: 'warning',
  });
}

/**
 * Handle database errors (500)
 */
export function handleDatabaseError(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>,
  error: unknown,
  operation?: string
): void {
  handleApiError(req, res, error, {
    statusCode: 500,
    errorCode: 'DATABASE_ERROR',
    userMessage: 'A database error occurred. Please try again.',
    context: operation ? { operation } : undefined,
    level: 'error',
  });
}

/**
 * Handle external service errors (502)
 */
export function handleExternalServiceError(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>,
  error: unknown,
  serviceName: string
): void {
  handleApiError(req, res, error, {
    statusCode: 502,
    errorCode: 'EXTERNAL_SERVICE_ERROR',
    userMessage: `Failed to connect to ${serviceName}. Please try again.`,
    context: { serviceName },
    level: 'error',
  });
}

/**
 * Handle Reddit API errors (502)
 */
export function handleRedditApiError(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>,
  error: unknown,
  operation?: string
): void {
  const message = error instanceof Error ? error.message : 'Reddit API error';
  handleApiError(req, res, error, {
    statusCode: 502,
    errorCode: 'REDDIT_API_ERROR',
    userMessage: message,
    context: operation ? { operation } : undefined,
    level: 'error',
  });
}

// ============================================================================
// Breadcrumb Helpers
// ============================================================================

/**
 * Add an API breadcrumb for debugging
 */
export function addApiBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    category: 'api',
    message,
    level,
    data,
  });
}

/**
 * Add a debug breadcrumb (use sparingly, replaces console.log)
 */
export function addDebugBreadcrumb(
  message: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'api.debug',
    message,
    level: 'debug',
    data,
  });
}

// ============================================================================
// Method Not Allowed Helper
// ============================================================================

/**
 * Handle method not allowed (405)
 */
export function handleMethodNotAllowed(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>,
  allowedMethods: string[]
): void {
  res.setHeader('Allow', allowedMethods.join(', '));
  handleApiError(req, res, new Error(`Method ${req.method} not allowed`), {
    statusCode: 405,
    errorCode: 'BAD_REQUEST',
    userMessage: `Method ${req.method} not allowed`,
    skipSentry: true,
    level: 'info',
  });
}
