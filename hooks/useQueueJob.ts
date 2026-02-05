/**
 * useQueueJob Hook
 * 
 * Manages the lifecycle of a queue job:
 * - Submit items to queue
 * - Subscribe to Realtime updates
 * - Poll the process endpoint to drive processing
 * - Handle cancellation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import {
  QueueJob,
  QueueJobItem,
  QueueJobResult,
  QueueJobStatus,
  JobProgressUpdate,
  QUEUE_JOB_CONSTANTS,
} from '@/lib/queueJob';
import { RealtimeChannel } from '@supabase/supabase-js';
import { captureClientError } from '@/lib/clientErrorHandler';

// ============================================================================
// Types
// ============================================================================

export interface QueueJobState {
  jobId: string | null;
  status: QueueJobStatus | null;
  items: QueueJobItem[];
  results: QueueJobResult[];
  currentIndex: number;
  error: string | null;
  isSubmitting: boolean;
  isProcessing: boolean;
  isConnected: boolean;
  waitingSeconds: number | null;
}

export interface QueueJobSubmission {
  items: Array<{
    subreddit: string;
    flairId?: string;
    titleSuffix?: string;
    kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
    url?: string;
    text?: string;
    file?: File;
    files?: File[];
  }>;
  caption: string;
  prefixes: { f?: boolean; c?: boolean };
}

/**
 * Single item for retry operations.
 * Used when retrying individual failed posts.
 */
export interface RetryItemInput {
  subreddit: string;
  flairId?: string;
  titleSuffix?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  text?: string;
  file?: File;
  files?: File[];
}

export interface UseQueueJobReturn {
  state: QueueJobState;
  submit: (submission: QueueJobSubmission) => Promise<string | null>;
  /** Submit a single item for retry. Returns job ID if successful. */
  retryItem: (
    item: RetryItemInput,
    caption: string,
    prefixes: { f?: boolean; c?: boolean }
  ) => Promise<string | null>;
  /** Submit multiple items for retry (batch retry). Returns job ID if successful. */
  retryItems: (
    items: RetryItemInput[],
    caption: string,
    prefixes: { f?: boolean; c?: boolean }
  ) => Promise<string | null>;
  cancel: () => Promise<boolean>;
  reset: () => void;
  resumeJob: (jobId: string) => Promise<void>;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: QueueJobState = {
  jobId: null,
  status: null,
  items: [],
  results: [],
  currentIndex: 0,
  error: null,
  isSubmitting: false,
  isProcessing: false,
  isConnected: false,
  waitingSeconds: null,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useQueueJob(): UseQueueJobReturn {
  const [state, setState] = useState<QueueJobState>(initialState);
  
  // Refs for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef(false);

  // ============================================================================
  // Realtime Subscription
  // ============================================================================

  const subscribeToJob = useCallback((jobId: string) => {
    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`queue_job:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'queue_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const job = payload.new as QueueJob;
          setState(prev => ({
            ...prev,
            status: job.status,
            currentIndex: job.current_index,
            results: job.results,
            error: job.error,
            isProcessing: job.status === 'processing',
          }));

          // Stop polling if job is done
          if (['completed', 'failed', 'cancelled'].includes(job.status)) {
            stopPolling();
          }
        }
      )
      .subscribe((status) => {
        setState(prev => ({
          ...prev,
          isConnected: status === 'SUBSCRIBED',
        }));
      });

    channelRef.current = channel;
  }, []);

  const unsubscribeFromJob = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // ============================================================================
  // Polling for Processing
  // ============================================================================

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isProcessingRef.current = false;
  }, []);

  const processJob = useCallback(async (jobId: string) => {
    if (isProcessingRef.current) {
      return; // Already processing
    }

    isProcessingRef.current = true;
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/queue/process?jobId=${jobId}`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process job');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Read streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';

        for (const line of parts) {
          if (!line.trim()) continue;
          
          try {
            const update: JobProgressUpdate = JSON.parse(line);
            
            switch (update.type) {
              case 'status':
                setState(prev => ({
                  ...prev,
                  status: update.status || prev.status,
                  currentIndex: update.currentIndex ?? prev.currentIndex,
                  isProcessing: update.status === 'processing',
                }));
                break;
              
              case 'progress':
                setState(prev => ({
                  ...prev,
                  currentIndex: update.currentIndex ?? prev.currentIndex,
                  waitingSeconds: null,
                }));
                break;
              
              case 'result':
                if (update.result) {
                  setState(prev => ({
                    ...prev,
                    results: [...prev.results, update.result!],
                    currentIndex: (update.result!.index || 0) + 1,
                    waitingSeconds: null,
                  }));
                }
                break;
              
              case 'waiting':
                setState(prev => ({
                  ...prev,
                  waitingSeconds: update.waitSeconds || null,
                }));
                break;
              
              case 'complete':
                setState(prev => ({
                  ...prev,
                  status: 'completed',
                  isProcessing: false,
                  waitingSeconds: null,
                }));
                stopPolling();
                break;
              
              case 'error':
                setState(prev => ({
                  ...prev,
                  error: update.error || 'Unknown error',
                  isProcessing: false,
                }));
                break;
            }
          } catch (parseError) {
            Sentry.addBreadcrumb({
              category: 'queue.stream',
              message: 'Failed to parse stream update',
              level: 'warning',
              data: { line },
            });
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Cancelled, ignore
      }
      const errorMessage = captureClientError(error, 'useQueueJob.processJob', {
        showToast: false, // Error shown in UI via state
        context: { jobId },
      });
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isProcessing: false,
      }));
    } finally {
      isProcessingRef.current = false;
    }
  }, [stopPolling]);

  const startPolling = useCallback((jobId: string) => {
    // Process immediately
    processJob(jobId);

    // Set up polling interval
    pollingRef.current = setInterval(() => {
      // Only start new process if not already processing
      if (!isProcessingRef.current) {
        processJob(jobId);
      }
    }, QUEUE_JOB_CONSTANTS.POLLING_INTERVAL_MS);
  }, [processJob]);

  // ============================================================================
  // Submit Job
  // ============================================================================

  const submit = useCallback(async (submission: QueueJobSubmission): Promise<string | null> => {
    setState(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      // Build FormData
      const formData = new FormData();
      
      // Add items (without File objects)
      const itemsForServer = submission.items.map(item => ({
        subreddit: item.subreddit,
        flairId: item.flairId,
        titleSuffix: item.titleSuffix,
        kind: item.kind,
        url: item.url,
        text: item.text,
      }));
      formData.append('items', JSON.stringify(itemsForServer));
      formData.append('caption', submission.caption);
      formData.append('prefixes', JSON.stringify(submission.prefixes));

      // Add files
      submission.items.forEach((item, index) => {
        if (item.files && item.files.length > 0) {
          item.files.forEach((file, fileIndex) => {
            formData.append(`file_${index}_${fileIndex}`, file);
          });
          formData.append(`fileCount_${index}`, item.files.length.toString());
        } else if (item.file) {
          formData.append(`file_${index}`, item.file);
          formData.append(`fileCount_${index}`, '1');
        }
      });

      // Submit to API
      const response = await fetch('/api/queue/submit', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit job');
      }

      const jobId = data.jobId;

      // Update state with job info
      setState(prev => ({
        ...prev,
        jobId,
        status: 'pending',
        items: itemsForServer,
        results: [],
        currentIndex: 0,
        isSubmitting: false,
        error: null,
      }));

      // Subscribe to updates and start processing
      subscribeToJob(jobId);
      startPolling(jobId);

      return jobId;
    } catch (error) {
      const errorMessage = captureClientError(error, 'useQueueJob.submit', {
        toastTitle: 'Submission Failed',
        context: { itemCount: submission.items.length },
      });
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [subscribeToJob, startPolling]);

  // ============================================================================
  // Retry Single Item
  // ============================================================================

  /**
   * Retry a single failed item.
   * Returns the job ID if submission succeeds, null otherwise.
   * Caller should monitor `state` for results (single item jobs complete quickly).
   */
  const retryItem = useCallback(async (
    item: RetryItemInput,
    caption: string,
    prefixes: { f?: boolean; c?: boolean }
  ): Promise<string | null> => {
    return submit({
      items: [item],
      caption,
      prefixes,
    });
  }, [submit]);

  // ============================================================================
  // Retry Multiple Items (Batch)
  // ============================================================================

  /**
   * Retry multiple failed items as a batch.
   * Returns the job ID if submission succeeds, null otherwise.
   * Caller should monitor `state` for results.
   */
  const retryItems = useCallback(async (
    items: RetryItemInput[],
    caption: string,
    prefixes: { f?: boolean; c?: boolean }
  ): Promise<string | null> => {
    if (items.length === 0) {
      return null;
    }

    return submit({
      items,
      caption,
      prefixes,
    });
  }, [submit]);

  // ============================================================================
  // Cancel Job
  // ============================================================================

  const cancel = useCallback(async (): Promise<boolean> => {
    const { jobId } = state;
    if (!jobId) return false;

    try {
      // Stop polling first
      stopPolling();

      const response = await fetch(`/api/queue/cancel/${jobId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to cancel job');
      }

      setState(prev => ({
        ...prev,
        status: 'cancelled',
        isProcessing: false,
      }));

      return true;
    } catch (error) {
      const errorMessage = captureClientError(error, 'useQueueJob.cancel', {
        toastTitle: 'Cancel Failed',
        context: { jobId: state.jobId },
      });
      setState(prev => ({
        ...prev,
        error: errorMessage,
      }));
      return false;
    }
  }, [state.jobId, stopPolling]);

  // ============================================================================
  // Resume Job (for page refresh)
  // ============================================================================

  const resumeJob = useCallback(async (jobId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/queue/status/${jobId}`);
      const data = await response.json();

      if (!response.ok || !data.job) {
        throw new Error(data.error || 'Job not found');
      }

      const job: QueueJob = data.job;

      setState({
        jobId: job.id,
        status: job.status,
        items: job.items,
        results: job.results,
        currentIndex: job.current_index,
        error: job.error,
        isSubmitting: false,
        isProcessing: job.status === 'processing',
        isConnected: false,
        waitingSeconds: null,
      });

      // If job is still active, subscribe and start polling
      if (['pending', 'processing'].includes(job.status)) {
        subscribeToJob(jobId);
        startPolling(jobId);
      }
    } catch (error) {
      const errorMessage = captureClientError(error, 'useQueueJob.resumeJob', {
        showToast: false, // Error shown in UI via state
        context: { jobId },
      });
      setState(prev => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [subscribeToJob, startPolling]);

  // ============================================================================
  // Reset
  // ============================================================================

  const reset = useCallback(() => {
    stopPolling();
    unsubscribeFromJob();
    setState(initialState);
  }, [stopPolling, unsubscribeFromJob]);

  // ============================================================================
  // Cleanup on Unmount
  // ============================================================================

  useEffect(() => {
    return () => {
      stopPolling();
      unsubscribeFromJob();
    };
  }, [stopPolling, unsubscribeFromJob]);

  // ============================================================================
  // Countdown timer for waiting
  // ============================================================================

  useEffect(() => {
    if (!state.waitingSeconds || state.waitingSeconds <= 0) return;

    const timer = setInterval(() => {
      setState(prev => {
        if (!prev.waitingSeconds || prev.waitingSeconds <= 1) {
          return { ...prev, waitingSeconds: null };
        }
        return { ...prev, waitingSeconds: prev.waitingSeconds - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state.waitingSeconds]);

  return {
    state,
    submit,
    retryItem,
    retryItems,
    cancel,
    reset,
    resumeJob,
  };
}
