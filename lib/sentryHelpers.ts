/**
 * Sentry Helper Functions for Queue Operations
 * 
 * Provides structured error logging and context management
 * specifically for the posting queue feature.
 */

import * as Sentry from '@sentry/nextjs';
import { formatFileSize } from './queueLimits';

// ============================================================================
// Types
// ============================================================================

export interface QueueContext {
  totalItems: number;
  totalBatches: number;
  hasFiles: boolean;
  totalFileSize: number;
  subreddits: string[];
}

export interface BatchContext {
  batchIndex: number;
  totalBatches: number;
  itemCount: number;
  fileSize: number;
  subreddits: string[];
  startTime?: number;
}

export type QueueErrorType = 
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'BATCH_ERROR'
  | 'TIMEOUT_ERROR'
  | 'STREAM_ERROR'
  | 'AUTH_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

// ============================================================================
// Context Management
// ============================================================================

/**
 * Sets Sentry context for the entire queue operation
 */
export const setQueueContext = (context: QueueContext): void => {
  Sentry.setContext('queue', {
    totalItems: context.totalItems,
    totalBatches: context.totalBatches,
    hasFiles: context.hasFiles,
    totalFileSize: context.totalFileSize,
    totalFileSizeFormatted: formatFileSize(context.totalFileSize),
    subredditCount: context.subreddits.length,
    subreddits: context.subreddits.slice(0, 20).join(', ') + 
      (context.subreddits.length > 20 ? '...' : ''),
  });
};

/**
 * Sets Sentry context for current batch
 */
export const setBatchContext = (context: BatchContext): void => {
  Sentry.setContext('batch', {
    batchIndex: context.batchIndex,
    totalBatches: context.totalBatches,
    itemCount: context.itemCount,
    fileSize: context.fileSize,
    fileSizeFormatted: formatFileSize(context.fileSize),
    subreddits: context.subreddits.join(', '),
    startTime: context.startTime,
  });
};

/**
 * Clears queue-related Sentry context
 */
export const clearQueueContext = (): void => {
  Sentry.setContext('queue', null);
  Sentry.setContext('batch', null);
};

// ============================================================================
// Breadcrumbs
// ============================================================================

/**
 * Adds a breadcrumb for queue operations
 */
export const addQueueBreadcrumb = (
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void => {
  Sentry.addBreadcrumb({
    category: 'posting.queue',
    message,
    level,
    data,
  });
};

/**
 * Adds a breadcrumb for batch operations
 */
export const addBatchBreadcrumb = (
  message: string,
  batchIndex: number,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void => {
  Sentry.addBreadcrumb({
    category: 'posting.batch',
    message,
    level,
    data: {
      batchIndex,
      ...data,
    },
  });
};

/**
 * Adds a breadcrumb for individual post attempts
 */
export const addPostBreadcrumb = (
  subreddit: string,
  status: 'posting' | 'success' | 'error',
  data?: Record<string, unknown>
): void => {
  const level: Sentry.SeverityLevel = status === 'error' ? 'warning' : 'info';
  
  Sentry.addBreadcrumb({
    category: 'posting.post',
    message: `Post to r/${subreddit}: ${status}`,
    level,
    data: {
      subreddit,
      status,
      ...data,
    },
  });
};

// ============================================================================
// Error Capture
// ============================================================================

/**
 * Captures a queue validation error
 */
export const captureValidationError = (
  error: string,
  context: Partial<QueueContext>
): void => {
  Sentry.captureMessage(`Queue validation failed: ${error}`, {
    level: 'warning',
    tags: {
      component: 'postingQueue',
      errorType: 'VALIDATION_ERROR',
    },
    extra: {
      validationError: error,
      ...context,
    },
  });
};

/**
 * Captures a queue-level error
 */
export const captureQueueError = (
  error: Error | unknown,
  errorType: QueueErrorType,
  context: Partial<QueueContext>,
  extra?: Record<string, unknown>
): string => {
  const eventId = Sentry.captureException(error, {
    tags: {
      component: 'postingQueue',
      errorType,
    },
    extra: {
      ...context,
      ...extra,
    },
  });

  return eventId;
};

/**
 * Captures a batch-level error
 */
export const captureBatchError = (
  error: Error | unknown,
  errorType: QueueErrorType,
  batchContext: BatchContext,
  queueContext?: Partial<QueueContext>,
  extra?: Record<string, unknown>
): string => {
  const eventId = Sentry.captureException(error, {
    tags: {
      component: 'postingQueue',
      errorType,
      batchIndex: batchContext.batchIndex,
    },
    extra: {
      batch: {
        index: batchContext.batchIndex,
        totalBatches: batchContext.totalBatches,
        itemCount: batchContext.itemCount,
        fileSize: batchContext.fileSize,
        subreddits: batchContext.subreddits,
        duration: batchContext.startTime 
          ? Date.now() - batchContext.startTime 
          : undefined,
      },
      queue: queueContext,
      ...extra,
    },
  });

  return eventId;
};

/**
 * Captures a timeout error with batch context
 */
export const captureTimeoutError = (
  batchContext: BatchContext,
  timeoutMs: number,
  queueContext?: Partial<QueueContext>
): string => {
  const error = new Error(`Batch ${batchContext.batchIndex + 1} timed out after ${Math.round(timeoutMs / 1000)} seconds`);
  
  return captureBatchError(
    error,
    'TIMEOUT_ERROR',
    batchContext,
    queueContext,
    { timeoutMs }
  );
};

/**
 * Captures a network error
 */
export const captureNetworkError = (
  error: Error | unknown,
  batchContext?: BatchContext,
  queueContext?: Partial<QueueContext>
): string => {
  if (batchContext) {
    return captureBatchError(error, 'NETWORK_ERROR', batchContext, queueContext);
  }

  return captureQueueError(error, 'NETWORK_ERROR', queueContext || {});
};

/**
 * Captures a stream error
 */
export const captureStreamError = (
  error: Error | unknown,
  batchContext: BatchContext,
  processedCount: number,
  queueContext?: Partial<QueueContext>
): string => {
  return captureBatchError(
    error,
    'STREAM_ERROR',
    batchContext,
    queueContext,
    { processedCount, partialCompletion: true }
  );
};

// ============================================================================
// Lifecycle Logging
// ============================================================================

/**
 * Logs queue start
 */
export const logQueueStart = (context: QueueContext): void => {
  setQueueContext(context);
  
  addQueueBreadcrumb('Queue started', {
    totalItems: context.totalItems,
    totalBatches: context.totalBatches,
    hasFiles: context.hasFiles,
    totalFileSize: formatFileSize(context.totalFileSize),
  });
};

/**
 * Logs queue completion
 */
export const logQueueComplete = (
  context: QueueContext,
  results: {
    successCount: number;
    errorCount: number;
    duration: number;
  }
): void => {
  addQueueBreadcrumb('Queue completed', {
    ...results,
    totalItems: context.totalItems,
    successRate: `${Math.round((results.successCount / context.totalItems) * 100)}%`,
  });

  // Clear context after completion
  clearQueueContext();
};

/**
 * Logs queue cancellation
 */
export const logQueueCancelled = (
  context: QueueContext,
  completedCount: number,
  currentBatchIndex: number
): void => {
  addQueueBreadcrumb('Queue cancelled', {
    completedCount,
    remainingCount: context.totalItems - completedCount,
    cancelledAtBatch: currentBatchIndex,
  }, 'warning');

  clearQueueContext();
};

/**
 * Logs batch start
 */
export const logBatchStart = (context: BatchContext): void => {
  setBatchContext(context);
  
  addBatchBreadcrumb(
    `Batch ${context.batchIndex + 1}/${context.totalBatches} started`,
    context.batchIndex,
    {
      itemCount: context.itemCount,
      fileSize: formatFileSize(context.fileSize),
    }
  );
};

/**
 * Logs batch completion
 */
export const logBatchComplete = (
  context: BatchContext,
  results: {
    successCount: number;
    errorCount: number;
  }
): void => {
  const duration = context.startTime ? Date.now() - context.startTime : 0;
  
  addBatchBreadcrumb(
    `Batch ${context.batchIndex + 1}/${context.totalBatches} completed`,
    context.batchIndex,
    {
      ...results,
      duration: `${Math.round(duration / 1000)}s`,
    }
  );
};

/**
 * Logs batch failure
 */
export const logBatchFailed = (
  context: BatchContext,
  error: string
): void => {
  addBatchBreadcrumb(
    `Batch ${context.batchIndex + 1}/${context.totalBatches} failed`,
    context.batchIndex,
    { error },
    'error'
  );
};
