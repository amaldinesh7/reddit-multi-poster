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
import {
  QueueJob,
  QueueJobItem,
  QueueJobResult,
  QueueJobStatus,
  JobProgressUpdate,
  QUEUE_JOB_CONSTANTS,
} from '@/lib/queueJob';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { captureClientError } from '@/lib/clientErrorHandler';
import { useDirectUpload, UploadedFile } from './useDirectUpload';

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
  isUploading: boolean;
  uploadProgress: { current: number; total: number; fileName: string } | null;
  waitingSeconds: number | null;
  startedAtMs: number | null;
  endedAtMs: number | null;
}

export interface QueueJobSubmission {
  items: Array<{
    subreddit: string;
    flairId?: string;
    titleSuffix?: string;
    customTitle?: string;
    kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
    url?: string;
    text?: string;
    file?: File;
    files?: File[];
  }>;
  caption: string;
  prefixes: { f?: boolean; c?: boolean };
}

export interface SubmitOptions {
  /** Show toast notification to user (default: true) */
  showToast?: boolean;
  /** Custom toast title (default: "Submission Failed") */
  toastTitle?: string;
}

/**
 * Single item for retry operations.
 * Used when retrying individual failed posts.
 */
export interface RetryItemInput {
  subreddit: string;
  flairId?: string;
  titleSuffix?: string;
  customTitle?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  text?: string;
  file?: File;
  files?: File[];
}

export interface UseQueueJobReturn {
  state: QueueJobState;
  submit: (submission: QueueJobSubmission, options?: SubmitOptions) => Promise<string | null>;
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
  isUploading: false,
  uploadProgress: null,
  waitingSeconds: null,
  startedAtMs: null,
  endedAtMs: null,
};

const generateJobFolder = (username: string): string => {
  const date = new Date().toISOString().split('T')[0];
  const shortId = Math.random().toString(36).substring(2, 10);
  return `${username}/${date}/job_${shortId}`;
};

const isTerminalStatus = (status: QueueJobStatus | null): boolean =>
  status === 'completed' || status === 'failed' || status === 'cancelled';

const mergeResultsByIndex = (
  prev: QueueJobResult[],
  next: QueueJobResult[]
): QueueJobResult[] => {
  const merged = new Map<number, QueueJobResult>();
  prev.forEach((result) => {
    merged.set(result.index, result);
  });
  next.forEach((result) => {
    const existing = merged.get(result.index);
    if (!existing) {
      merged.set(result.index, result);
      return;
    }
    merged.set(result.index, {
      ...existing,
      ...result,
      url: result.url ?? existing.url,
      error: result.error ?? existing.error,
      postedAt: result.postedAt ?? existing.postedAt,
    });
  });
  return Array.from(merged.values()).sort((a, b) => a.index - b.index);
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useQueueJob(): UseQueueJobReturn {
  const [state, setState] = useState<QueueJobState>(initialState);
  const { uploadFiles, cancelUpload, isUploading, progress: uploadProgress } = useDirectUpload();
  
  // Refs for cleanup
  const supabaseClientRef = useRef<SupabaseClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef(false);

  // Sync upload state
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isUploading,
      uploadProgress,
    }));
  }, [isUploading, uploadProgress]);

  // ============================================================================
  // Realtime Subscription
  // ============================================================================

  const getSupabaseClient = useCallback(async (): Promise<SupabaseClient> => {
    if (supabaseClientRef.current) {
      return supabaseClientRef.current;
    }

    const module = await import('@/lib/supabase');
    supabaseClientRef.current = module.supabase;
    return module.supabase;
  }, []);

  const removeCurrentChannel = useCallback(() => {
    if (channelRef.current && supabaseClientRef.current) {
      supabaseClientRef.current.removeChannel(channelRef.current);
    }
    channelRef.current = null;
  }, []);

  const subscribeToJob = useCallback(async (jobId: string) => {
    const supabaseClient = await getSupabaseClient();

    // Clean up existing subscription
    removeCurrentChannel();

    const channel = supabaseClient
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
            results: mergeResultsByIndex(prev.results, job.results || []),
            error: job.error,
            isProcessing: job.status === 'processing',
            startedAtMs: prev.startedAtMs ?? (job.started_at ? Date.parse(job.started_at) : null),
            endedAtMs: isTerminalStatus(job.status)
              ? (job.completed_at ? Date.parse(job.completed_at) : Date.now())
              : prev.endedAtMs,
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
  }, [getSupabaseClient, removeCurrentChannel]);

  const unsubscribeFromJob = useCallback(() => {
    removeCurrentChannel();
  }, [removeCurrentChannel]);

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
                    results: mergeResultsByIndex(prev.results, [update.result!]),
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
                  endedAtMs: prev.endedAtMs ?? Date.now(),
                }));
                stopPolling();
                break;
              
              case 'error':
                setState(prev => ({
                  ...prev,
                  error: update.error || 'Unknown error',
                  isProcessing: false,
                  endedAtMs: prev.endedAtMs ?? Date.now(),
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
        endedAtMs: prev.endedAtMs ?? Date.now(),
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

  const submit = useCallback(async (
    submission: QueueJobSubmission,
    options: SubmitOptions = {}
  ): Promise<string | null> => {
    const { showToast = true, toastTitle = 'Submission Failed' } = options;

    setState(prev => ({
      ...prev,
      isSubmitting: true,
      error: null,
      startedAtMs: Date.now(),
      endedAtMs: null,
    }));

    try {
      // Add items (without File objects)
      const itemsForServer = submission.items.map(item => ({
        subreddit: item.subreddit,
        flairId: item.flairId,
        titleSuffix: item.titleSuffix,
        customTitle: item.customTitle,
        kind: item.kind,
        url: item.url,
        text: item.text,
      }));

      // Collect shared files (uploaded once, used by all items)
      const firstItemWithFiles = submission.items.find(item => item.files?.length || item.file);
      const sharedFiles = firstItemWithFiles
        ? (firstItemWithFiles.files || (firstItemWithFiles.file ? [firstItemWithFiles.file] : []))
        : [];

      const hasMediaKind = submission.items.some(item =>
        item.kind === 'image' || item.kind === 'video' || item.kind === 'gallery'
      );
      if (hasMediaKind && sharedFiles.length === 0) {
        throw new Error('Please attach a media file for image, video, or gallery posts.');
      }

      // Generate job folder for direct uploads
      const jobFolder = generateJobFolder('user');
      let uploadedFiles: UploadedFile[] = [];

      // Upload files directly to Supabase Storage (bypasses Vercel 4.5MB limit)
      if (sharedFiles.length > 0) {
        uploadedFiles = await uploadFiles(sharedFiles, jobFolder, -1);
      }

      // Build request body (metadata only - no file binaries)
      const requestBody = {
        items: itemsForServer,
        caption: submission.caption,
        prefixes: submission.prefixes,
        jobFolder,
        storagePaths: uploadedFiles.map(f => ({
          storagePath: f.storagePath,
          fileName: f.fileName,
          mimeType: f.mimeType,
          fileSize: f.fileSize,
          itemIndex: f.itemIndex,
          fileIndex: f.fileIndex,
        })),
      };

      // Submit to API (lightweight JSON, no file binaries)
      const response = await fetch('/api/queue/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
        isUploading: false,
        uploadProgress: null,
        error: null,
        startedAtMs: Date.now(),
        endedAtMs: null,
      }));

      // Subscribe to updates and start processing
      subscribeToJob(jobId);
      startPolling(jobId);

      return jobId;
    } catch (error) {
      const errorMessage = captureClientError(error, 'useQueueJob.submit', {
        showToast,
        toastTitle,
        context: { itemCount: submission.items.length },
      });
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        isUploading: false,
        uploadProgress: null,
        error: errorMessage,
        endedAtMs: prev.endedAtMs ?? Date.now(),
      }));
      return null;
    }
  }, [subscribeToJob, startPolling, uploadFiles]);

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
    }, { showToast: false, toastTitle: 'Retry Failed' });
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
    }, { showToast: false, toastTitle: 'Retry Failed' });
  }, [submit]);

  // ============================================================================
  // Cancel Job
  // ============================================================================

  const cancel = useCallback(async (): Promise<boolean> => {
    const { jobId, isSubmitting } = state;

    // Cancel during upload phase (no jobId yet)
    if (!jobId && isSubmitting) {
      cancelUpload();
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        isUploading: false,
        uploadProgress: null,
        error: 'Upload cancelled',
        endedAtMs: Date.now(),
      }));
      return true;
    }

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
        endedAtMs: prev.endedAtMs ?? Date.now(),
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
        endedAtMs: prev.endedAtMs ?? Date.now(),
      }));
      return false;
    }
  }, [state.jobId, state.isSubmitting, stopPolling, cancelUpload]);

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
        isUploading: false,
        uploadProgress: null,
        waitingSeconds: null,
        startedAtMs: job.started_at ? Date.parse(job.started_at) : null,
        endedAtMs: isTerminalStatus(job.status)
          ? (job.completed_at ? Date.parse(job.completed_at) : Date.now())
          : null,
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
