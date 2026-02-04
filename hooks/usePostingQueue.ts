import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type QueueItemData,
  type LogEntry,
  type CurrentWait,
  type QueueError,
  type QueueErrorCode,
  type BatchState,
  type BatchInfo,
  type UsePostingQueueProps,
  type UsePostingQueueReturn,
} from '@/components/posting-queue/types';
import {
  QUEUE_LIMITS,
  validateQueue,
  splitIntoBatches,
  getBatchInfo,
  getBatchStartIndex,
  calculateItemsFileSize,
  withTimeout,
} from '@/lib/queueLimits';
import {
  setQueueContext,
  setBatchContext,
  clearQueueContext,
  addQueueBreadcrumb,
  addBatchBreadcrumb,
  addPostBreadcrumb,
  captureQueueError,
  captureBatchError,
  captureTimeoutError,
  captureStreamError,
  captureValidationError,
  logQueueStart,
  logQueueComplete,
  logQueueCancelled,
  logBatchStart,
  logBatchComplete,
  logBatchFailed,
} from '@/lib/sentryHelpers';

// ============================================================================
// Error Message Helper
// ============================================================================

const getErrorMessage = (error: unknown, code: QueueErrorCode, batchIndex?: number): QueueError => {
  const baseError = error instanceof Error ? error : new Error('Unknown error');
  
  switch (code) {
    case 'VALIDATION_ERROR':
      return {
        message: baseError.message,
        code,
        details: 'Fix the issues above (e.g. pick a flair where needed), then try again.',
        recoverable: false,
      };
    case 'NETWORK_ERROR':
      return {
        message: 'Can\'t connect. Check your connection and try again.',
        code,
        details: baseError.message,
        batchIndex,
        recoverable: true,
      };
    case 'AUTH_ERROR':
      return {
        message: 'You\'re signed out. Sign in again to continue.',
        code,
        details: 'You need to sign in again.',
        recoverable: false,
      };
    case 'SERVER_ERROR':
      return {
        message: 'Something went wrong. Try again in a moment.',
        code,
        details: baseError.message,
        batchIndex,
        recoverable: true,
      };
    case 'STREAM_ERROR':
      return {
        message: 'Connection dropped. Some may have already posted.',
        code,
        details: baseError.message,
        batchIndex,
        recoverable: true,
      };
    case 'TIMEOUT_ERROR':
      return {
        message: 'Took too long. Some may have already posted.',
        code,
        details: baseError.message,
        batchIndex,
        recoverable: true,
      };
    case 'BATCH_ERROR':
      return {
        message: 'One round failed. Rest will continue.',
        code,
        details: baseError.message,
        batchIndex,
        recoverable: true,
      };
    default:
      return {
        message: 'Something went wrong. Try again.',
        code: 'UNKNOWN_ERROR',
        details: baseError.message,
        batchIndex,
        recoverable: true,
      };
  }
};

// ============================================================================
// Hook Implementation
// ============================================================================

export const usePostingQueue = ({
  items,
  caption,
  prefixes,
  hasFlairErrors,
  onPostAttempt,
}: UsePostingQueueProps): UsePostingQueueReturn => {
  // Core state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [currentWait, setCurrentWait] = useState<CurrentWait | null>(null);
  const [error, setError] = useState<QueueError | null>(null);

  // Batch state
  const [batchStates, setBatchStates] = useState<BatchState[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number | null>(null);

  // Refs for stable references during async operations
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const queueStartTimeRef = useRef<number>(0);

  // Calculate batch info based on current items
  const batchInfo: BatchInfo = getBatchInfo(items);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Process a single batch of items
   */
  const processBatch = useCallback(async (
    batch: QueueItemData[],
    batchIndex: number,
    globalStartIndex: number,
    totalBatches: number,
    controller: AbortController
  ): Promise<{ successCount: number; errorCount: number }> => {
    const batchFileSize = calculateItemsFileSize(batch);
    const batchStartTime = Date.now();

    // Create batch context for Sentry
    const batchContext = {
      batchIndex,
      totalBatches,
      itemCount: batch.length,
      fileSize: batchFileSize,
      subreddits: batch.map(i => i.subreddit),
      startTime: batchStartTime,
    };

    setBatchContext(batchContext);
    logBatchStart(batchContext);

    // Update batch state to running
    setBatchStates(prev => prev.map((bs, idx) => 
      idx === batchIndex ? { ...bs, status: 'running', startTime: batchStartTime } : bs
    ));

    const hasFiles = batch.some(item => item.file || (item.files && item.files.length > 0));

    let res: Response;
    try {
      if (hasFiles) {
        const formData = new FormData();
        formData.append('items', JSON.stringify(batch.map(item => ({
          subreddit: item.subreddit,
          flairId: item.flairId,
          titleSuffix: item.titleSuffix,
          kind: item.kind,
          url: item.url,
          text: item.text,
        }))));
        formData.append('caption', caption);
        formData.append('prefixes', JSON.stringify(prefixes));

        batch.forEach((item, index) => {
          if (item.files && item.files.length > 0) {
            item.files.forEach((file, fileIndex) => {
              formData.append(`file_${index}_${fileIndex}`, file);
            });
            formData.append(`fileCount_${index}`, item.files.length.toString());
          } else if (item.file) {
            formData.append(`file_${index}`, item.file);
          }
        });

        res = await fetch('/api/queue', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } else {
        res = await fetch('/api/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batch, caption, prefixes }),
          signal: controller.signal,
        });
      }
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw fetchError; // Re-throw abort errors
      }

      captureBatchError(fetchError, 'NETWORK_ERROR', batchContext);
      logBatchFailed(batchContext, 'Network error');
      throw fetchError;
    }

    // Check for HTTP errors
    if (!res.ok) {
      let errorDetails = `HTTP ${res.status}`;
      try {
        const errorBody = await res.text();
        errorDetails = errorBody || errorDetails;
      } catch {
        // Ignore parse errors
      }

      const errorType: QueueErrorCode = res.status === 401 ? 'AUTH_ERROR' : 'SERVER_ERROR';
      const httpError = new Error(errorDetails);

      captureBatchError(httpError, errorType, batchContext);
      logBatchFailed(batchContext, errorDetails);
      throw httpError;
    }

    if (!res.body) {
      const noBodyError = new Error('No response body');
      captureBatchError(noBodyError, 'SERVER_ERROR', batchContext);
      logBatchFailed(batchContext, 'No response body');
      throw noBodyError;
    }

    // Process streaming response
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let batchSuccessCount = 0;
    let batchErrorCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';

        for (const line of parts) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);

            if (json.status === 'waiting') {
              // Map batch index to global index
              const globalIndex = globalStartIndex + json.index;
              setCurrentWait({ 
                index: globalIndex, 
                seconds: json.delaySeconds, 
                remaining: json.delaySeconds 
              });
            } else if (typeof json.index === 'number' && json.subreddit) {
              // Map batch-local index to global index
              const globalIndex = globalStartIndex + json.index;
              
              setCurrentWait(null);
              setLogs(prev => prev.map(log => {
                if (log.index === globalIndex && log.subreddit === json.subreddit) {
                  return { ...log, ...json, index: globalIndex };
                }
                return log;
              }));

              // Update batch state counts
              if (json.status === 'success') {
                batchSuccessCount++;
                addPostBreadcrumb(json.subreddit, 'success', { url: json.url });
              } else if (json.status === 'error') {
                batchErrorCount++;
                addPostBreadcrumb(json.subreddit, 'error', { error: json.error });
              }

              // Update batch state with progress
              setBatchStates(prev => prev.map((bs, idx) =>
                idx === batchIndex 
                  ? { 
                      ...bs, 
                      completedItems: batchSuccessCount + batchErrorCount,
                      successCount: batchSuccessCount,
                      errorCount: batchErrorCount,
                    } 
                  : bs
              ));
            }
          } catch (parseError) {
            console.error('Failed to parse streaming JSON:', line, parseError);
            addBatchBreadcrumb('Parse error in stream', batchIndex, { line }, 'warning');
          }
        }
      }
    } catch (streamError) {
      if (streamError instanceof Error && streamError.name === 'AbortError') {
        throw streamError;
      }

      captureStreamError(streamError, batchContext, batchSuccessCount + batchErrorCount);
      logBatchFailed(batchContext, 'Stream error');
      throw streamError;
    }

    // Mark batch as completed
    const endTime = Date.now();
    setBatchStates(prev => prev.map((bs, idx) =>
      idx === batchIndex 
        ? { 
            ...bs, 
            status: 'completed',
            endTime,
            completedItems: batch.length,
            successCount: batchSuccessCount,
            errorCount: batchErrorCount,
          } 
        : bs
    ));

    logBatchComplete(batchContext, { successCount: batchSuccessCount, errorCount: batchErrorCount });

    return { successCount: batchSuccessCount, errorCount: batchErrorCount };
  }, [caption, prefixes]);

  /**
   * Main start function - processes all batches
   */
  const start = useCallback(async () => {
    if (onPostAttempt) {
      onPostAttempt();
    }

    if (hasFlairErrors) {
      return;
    }

    if (items.length === 0) {
      return;
    }

    // Validate queue
    const validation = validateQueue(items);
    if (!validation.valid) {
      const validationError = getErrorMessage(new Error(validation.error || 'Validation failed'), 'VALIDATION_ERROR');
      setError(validationError);
      captureValidationError(validation.error || 'Unknown validation error', {
        totalItems: items.length,
        hasFiles: items.some(i => i.file || i.files),
        totalFileSize: calculateItemsFileSize(items),
        subreddits: items.map(i => i.subreddit),
        totalBatches: 0,
      });
      return;
    }

    // Capture items snapshot to prevent mid-queue changes
    const itemsSnapshot = [...items];
    const batches = splitIntoBatches(itemsSnapshot);
    const totalBatches = batches.length;
    const hasFiles = itemsSnapshot.some(item => item.file || (item.files && item.files.length > 0));
    const totalFileSize = calculateItemsFileSize(itemsSnapshot);

    // Initialize state
    setRunning(true);
    setCompleted(false);
    setCancelled(false);
    cancelledRef.current = false;
    setCurrentWait(null);
    setError(null);
    setCurrentBatchIndex(0);
    queueStartTimeRef.current = Date.now();

    // Initialize all logs as queued
    const initialLogs: LogEntry[] = itemsSnapshot.map((item, index) => ({
      index,
      status: 'queued',
      subreddit: item.subreddit,
      url: undefined,
      error: undefined,
    }));
    setLogs(initialLogs);

    // Initialize batch states
    const initialBatchStates: BatchState[] = batches.map((batch, idx) => ({
      batchIndex: idx,
      status: 'pending',
      completedItems: 0,
      totalItems: batch.length,
      successCount: 0,
      errorCount: 0,
    }));
    setBatchStates(initialBatchStates);

    // Set Sentry context
    const queueContext = {
      totalItems: itemsSnapshot.length,
      totalBatches,
      hasFiles,
      totalFileSize,
      subreddits: itemsSnapshot.map(i => i.subreddit),
    };
    logQueueStart(queueContext);

    // Create abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let totalSuccessCount = 0;
    let totalErrorCount = 0;
    let failedBatches: number[] = [];

    // Process batches sequentially
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      // Check if cancelled
      if (cancelledRef.current) {
        logQueueCancelled(queueContext, totalSuccessCount, batchIndex);
        break;
      }

      const batch = batches[batchIndex];
      const globalStartIndex = getBatchStartIndex(batches, batchIndex);
      setCurrentBatchIndex(batchIndex);

      try {
        // Process batch with timeout
        const result = await withTimeout(
          processBatch(batch, batchIndex, globalStartIndex, totalBatches, controller),
          QUEUE_LIMITS.BATCH_TIMEOUT_MS
        );

        totalSuccessCount += result.successCount;
        totalErrorCount += result.errorCount;
      } catch (batchError) {
        // Check for abort/cancellation
        if (batchError instanceof Error && batchError.name === 'AbortError') {
          setCancelled(true);
          cancelledRef.current = true;
          logQueueCancelled(queueContext, totalSuccessCount, batchIndex);
          break;
        }

        // Check for timeout
        if (batchError instanceof Error && batchError.message.includes('timed out')) {
          captureTimeoutError(
            {
              batchIndex,
              totalBatches,
              itemCount: batch.length,
              fileSize: calculateItemsFileSize(batch),
              subreddits: batch.map(i => i.subreddit),
              startTime: Date.now(),
            },
            QUEUE_LIMITS.BATCH_TIMEOUT_MS,
            queueContext
          );
        }

        // Mark batch as failed
        setBatchStates(prev => prev.map((bs, idx) =>
          idx === batchIndex 
            ? { 
                ...bs, 
                status: 'failed',
                error: batchError instanceof Error ? batchError.message : 'Unknown error',
                endTime: Date.now(),
              } 
            : bs
        ));

        failedBatches.push(batchIndex);

        // Set error but continue with other batches (best effort)
        if (!error) {
          const batchQueueError = getErrorMessage(batchError, 'BATCH_ERROR', batchIndex);
          setError(batchQueueError);
        }

        addBatchBreadcrumb(`Batch ${batchIndex + 1} failed, continuing...`, batchIndex, {}, 'warning');
      }
    }

    // Finalize
    setRunning(false);
    setCurrentBatchIndex(null);
    setCurrentWait(null);
    abortControllerRef.current = null;

    // Check completion
    const queueDuration = Date.now() - queueStartTimeRef.current;
    
    if (!cancelledRef.current) {
      const allSuccess = totalSuccessCount === itemsSnapshot.length;
      if (allSuccess) {
        setCompleted(true);
      }
      
      logQueueComplete(queueContext, {
        successCount: totalSuccessCount,
        errorCount: totalErrorCount,
        duration: queueDuration,
      });
    }

  }, [items, caption, prefixes, hasFlairErrors, onPostAttempt, processBatch, error]);

  /**
   * Cancel the current queue operation
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      cancelledRef.current = true;
      setCancelled(true);
      setRunning(false);
      setCurrentBatchIndex(null);
      setCurrentWait(null);

      addQueueBreadcrumb('Queue cancelled by user', {
        completedBatches: batchStates.filter(bs => bs.status === 'completed').length,
        currentBatch: currentBatchIndex,
      }, 'warning');
    }
  }, [batchStates, currentBatchIndex]);

  /**
   * Reset the queue state
   */
  const reset = useCallback(() => {
    setCompleted(false);
    setLogs([]);
    setCancelled(false);
    cancelledRef.current = false;
    setError(null);
    setBatchStates([]);
    setCurrentBatchIndex(null);
    setCurrentWait(null);
    clearQueueContext();
  }, []);

  /**
   * Retry only the failed batches
   */
  const retryFailedBatches = useCallback(async () => {
    const failedBatchIndices = batchStates
      .filter(bs => bs.status === 'failed')
      .map(bs => bs.batchIndex);

    if (failedBatchIndices.length === 0) {
      return;
    }

    // Get the original batches
    const itemsSnapshot = [...items];
    const allBatches = splitIntoBatches(itemsSnapshot);
    
    setRunning(true);
    setCancelled(false);
    cancelledRef.current = false;
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    addQueueBreadcrumb('Retrying failed batches', { 
      failedBatchIndices,
      count: failedBatchIndices.length,
    });

    for (const batchIndex of failedBatchIndices) {
      if (cancelledRef.current) break;

      const batch = allBatches[batchIndex];
      if (!batch) continue;

      const globalStartIndex = getBatchStartIndex(allBatches, batchIndex);
      setCurrentBatchIndex(batchIndex);

      // Reset batch state to pending before retry
      setBatchStates(prev => prev.map((bs, idx) =>
        idx === batchIndex 
          ? { 
              ...bs, 
              status: 'pending',
              error: undefined,
              successCount: 0,
              errorCount: 0,
              completedItems: 0,
            } 
          : bs
      ));

      // Reset logs for this batch
      setLogs(prev => prev.map(log => {
        const isInBatch = log.index >= globalStartIndex && log.index < globalStartIndex + batch.length;
        if (isInBatch) {
          return { ...log, status: 'queued', error: undefined, url: undefined };
        }
        return log;
      }));

      try {
        await withTimeout(
          processBatch(batch, batchIndex, globalStartIndex, allBatches.length, controller),
          QUEUE_LIMITS.BATCH_TIMEOUT_MS
        );
      } catch (retryError) {
        if (retryError instanceof Error && retryError.name === 'AbortError') {
          setCancelled(true);
          cancelledRef.current = true;
          break;
        }

        setBatchStates(prev => prev.map((bs, idx) =>
          idx === batchIndex 
            ? { 
                ...bs, 
                status: 'failed',
                error: retryError instanceof Error ? retryError.message : 'Retry failed',
              } 
            : bs
        ));
      }
    }

    setRunning(false);
    setCurrentBatchIndex(null);
    abortControllerRef.current = null;

    // Check if all batches are now complete
    const allComplete = batchStates.every(bs => bs.status === 'completed');
    if (allComplete) {
      setCompleted(true);
    }
  }, [items, batchStates, processBatch]);

  // Countdown timer effect
  useEffect(() => {
    if (!currentWait || currentWait.remaining <= 0) return;

    const timer = setInterval(() => {
      setCurrentWait(prev => {
        if (!prev || prev.remaining <= 1) return prev;
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentWait?.index, currentWait?.seconds]);

  return {
    logs,
    running,
    completed,
    cancelled,
    currentWait,
    error,
    batchInfo,
    batchStates,
    currentBatchIndex,
    start,
    cancel,
    reset,
    clearError,
    retryFailedBatches,
  };
};
