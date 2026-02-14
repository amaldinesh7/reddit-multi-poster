import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import {
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  X,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  LogIn,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { useQueueJob, RetryItemInput } from '../hooks/useQueueJob';
import { QueueProgressList, FailedPostsPanel, EditFailedPostDialog, ValidationWarnings } from './posting-queue';
import { QUEUE_LIMITS, formatFileSize, calculateItemsFileSize } from '@/lib/queueLimits';
import { MobileStickyQueue } from './MobileStickyQueue';
import { LogEntry } from './posting-queue/types';
import { useFailedPosts, FailedPost } from '../hooks/useFailedPosts';
import { useSubredditFlairData } from '../hooks/useSubredditFlairData';
import { ErrorCategory } from '@/lib/errorClassification';
import { usePreflightValidation, ValidationIssue } from '../hooks/usePreflightValidation';
import type { PreflightResult } from '@/lib/preflightValidation';
import type { PerSubredditOverride } from './subreddit-picker';
import { normalizeSubredditKey } from '@/lib/subredditKey';

interface Item {
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

interface Props {
  items: Item[];
  caption: string;
  /** Post body/description text */
  body?: string;
  /** Per-subreddit content overrides (custom title/body) */
  contentOverrides?: Record<string, PerSubredditOverride>;
  /** Legacy per-subreddit custom titles */
  customTitles?: Record<string, string>;
  prefixes: { f?: boolean; c?: boolean };
  hasFlairErrors?: boolean;
  /** Returns true to allow posting, false to block. Errors also block posting. */
  onPostAttempt?: () => boolean;
  onUnselectSuccessItems?: (subreddits: string[]) => void;
  onClearAll?: () => void;
  onResetMedia?: () => void;
  /** Max items allowed (e.g. 5 for paid). Falls back to QUEUE_LIMITS.MAX_TOTAL_ITEMS */
  maxItems?: number;
  /** Callback when posting results are available (for failed post tracking) */
  onResultsAvailable?: (results: Array<{ index: number; status: 'success' | 'error' | 'skipped'; subreddit: string; error?: string; url?: string }>, items: Item[]) => void;
  /** Callback when validation issues change (for inline error display) */
  onValidationChange?: (issuesBySubreddit: Record<string, ValidationIssue[]>) => void;
  /** Callback when full validation state changes (for review panel) */
  onValidationStateChange?: (state: {
    canSubmit: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    result: PreflightResult;
    issuesBySubreddit: Record<string, ValidationIssue[]>;
  }) => void;
  mode?: 'inline' | 'review-entry';
  onPostActionReady?: (handler: () => void) => void;
  onReviewRequest?: () => void;
  hideMobileBar?: boolean;
}

export interface PostingQueueHandle {
  triggerPost: () => void;
}

// ============================================================================
// Sub-Components
// ============================================================================


interface BatchProgressProps {
  batchStates: Array<{
    batchIndex: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    completedItems: number;
    totalItems: number;
    successCount: number;
    errorCount: number;
    error?: string;
  }>;
  currentBatchIndex: number | null;
  onRetryFailed?: () => void;
}

const BatchProgress: React.FC<BatchProgressProps> = ({
  batchStates,
  currentBatchIndex,
  onRetryFailed,
}) => {
  if (batchStates.length <= 1) return null;

  const completedBatches = batchStates.filter(bs => bs.status === 'completed').length;
  const failedBatches = batchStates.filter(bs => bs.status === 'failed').length;
  const totalBatches = batchStates.length;

  return (
    <div className="rounded-md bg-zinc-800/50 border border-zinc-700/50 p-3 space-y-2">
      {/* Batch Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Layers className="h-4 w-4" aria-hidden="true" />
          <span>Posting in rounds</span>
        </div>
        <span className="text-xs text-zinc-400">
          {completedBatches} of {totalBatches} posted
        </span>
      </div>

      {/* Batch Status Indicators */}
      <div className="flex gap-1.5">
        {batchStates.map((batch) => (
          <div
            key={batch.batchIndex}
            className={`flex-1 h-2 rounded-full transition-all duration-300 ${batch.status === 'completed'
              ? 'bg-green-500'
              : batch.status === 'failed'
                ? 'bg-red-500'
                : batch.status === 'running'
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-zinc-700'
              }`}
            title={`Round ${batch.batchIndex + 1}: ${batch.status}`}
          />
        ))}
      </div>

      {/* Current Batch Info */}
      {currentBatchIndex !== null && batchStates[currentBatchIndex] && (
        <div className="text-xs text-zinc-400 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          <span>
            Round {currentBatchIndex + 1} of {totalBatches}
            {' '}({batchStates[currentBatchIndex].completedItems}/{batchStates[currentBatchIndex].totalItems} posted)
          </span>
        </div>
      )}

      {/* Failed Batches Info */}
      {failedBatches > 0 && currentBatchIndex === null && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-red-400">
            {failedBatches} round{failedBatches !== 1 ? 's' : ''} failed
          </span>
          {onRetryFailed && (
            <Button
              onClick={onRetryFailed}
              variant="outline"
              size="sm"
              className="h-6 text-xs cursor-pointer border-red-600/50 text-red-400 hover:bg-red-600/20"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const PostingQueue = React.forwardRef<PostingQueueHandle, Props>(({
  items,
  caption,
  body,
  contentOverrides,
  customTitles,
  prefixes,
  hasFlairErrors,
  onPostAttempt,
  onUnselectSuccessItems,
  onClearAll,
  onResetMedia,
  maxItems: maxItemsProp,
  onResultsAvailable,
  onValidationChange,
  onValidationStateChange,
  mode = 'inline',
  onPostActionReady,
  onReviewRequest,
  hideMobileBar = false,
}, ref) => {
  const router = useRouter();
  const maxItems = maxItemsProp ?? QUEUE_LIMITS.MAX_TOTAL_ITEMS;
  const {
    state,
    submit,
    retryItem,
    retryItems,
    cancel,
    reset,
  } = useQueueJob();

  // Failed posts management
  const failedPostsHook = useFailedPosts();

  // Track which failed post is being edited
  const [editingPost, setEditingPost] = useState<FailedPost | null>(null);

  // Track if a retry is in progress
  const [isRetrying, setIsRetrying] = useState(false);

  // Track if user dismissed validation warnings
  const [validationDismissed, setValidationDismissed] = useState(false);

  // Get flair data for the currently editing post's subreddit
  const editingSubreddit = editingPost?.subreddit || '';
  const flairDataResult = useSubredditFlairData();
  const editFlairOptions = flairDataResult.flairOptions[editingSubreddit] || [];
  const editFlairLoading = flairDataResult.cacheLoading[editingSubreddit] || false;
  const editFlairRequired = flairDataResult.flairRequired[editingSubreddit] || false;

  // ============================================================================
  // Pre-flight Validation
  // ============================================================================

  // Build validation input from items
  // IMPORTANT: Use normalized subreddit keys to match the keys used in flairDataResult
  const validationInput = useMemo(() => {
    const subreddits = items.map(i => normalizeSubredditKey(i.subreddit));
    const flairValue: Record<string, string | undefined> = {};
    const titleSuffixes: Record<string, string | undefined> = {};
    const titleBySubreddit: Record<string, string | undefined> = {};
    const bodyBySubreddit: Record<string, string | undefined> = {};

    items.forEach(item => {
      const key = normalizeSubredditKey(item.subreddit);
      flairValue[key] = item.flairId;
      titleSuffixes[key] = item.titleSuffix;
      const override = contentOverrides?.[item.subreddit] ?? contentOverrides?.[key];
      const overrideTitle = override?.title ?? customTitles?.[item.subreddit] ?? customTitles?.[key];
      if (overrideTitle !== undefined) {
        titleBySubreddit[key] = overrideTitle;
      }
      if (override?.body !== undefined) {
        bodyBySubreddit[key] = override.body;
      }
    });

    // Determine kind and url from the first item (all items in a post share the same type)
    const firstItem = items[0];
    const kind = firstItem?.kind || 'self';
    const url = firstItem?.url;

    return {
      title: caption,
      body,
      kind,
      url,
      subreddits,
      flairValue,
      flairRequired: flairDataResult.flairRequired,
      flairOptions: flairDataResult.flairOptions,
      postRequirements: flairDataResult.postRequirements,
      titleSuffixes,
      titleBySubreddit,
      bodyBySubreddit,
    };
  }, [items, caption, body, contentOverrides, customTitles, flairDataResult.flairRequired, flairDataResult.flairOptions, flairDataResult.postRequirements]);

  // Run pre-flight validation
  const validation = usePreflightValidation(validationInput);

  // Notify parent about validation changes for inline display
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(validation.issuesBySubreddit);
    }
  }, [validation.issuesBySubreddit, onValidationChange]);

  useEffect(() => {
    if (onValidationStateChange) {
      onValidationStateChange({
        canSubmit: validation.canSubmit,
        errors: validation.errors,
        warnings: validation.warnings,
        result: validation.result,
        issuesBySubreddit: validation.issuesBySubreddit,
      });
    }
  }, [
    onValidationStateChange,
    validation.canSubmit,
    validation.errors,
    validation.warnings,
    validation.result,
    validation.issuesBySubreddit,
  ]);

  // Reset validation dismissed state when items change
  useEffect(() => {
    setValidationDismissed(false);
  }, [items, caption, body, contentOverrides, customTitles]);

  // Show validation warnings only when there are issues and not dismissed
  // When onValidationChange is provided, we use inline display instead of the panel
  const showValidationWarnings = !onValidationChange &&
    !validationDismissed &&
    items.length > 0 &&
    (validation.errors.length > 0 || validation.warnings.length > 0) &&
    !state.isProcessing &&
    state.status !== 'processing';

  // Add failed results from queue job to failed posts when job completes
  // Track processed job IDs to prevent duplicate additions
  const processedJobRef = React.useRef<string | null>(null);

  useEffect(() => {
    // Only process when job transitions to completed/failed
    if (state.status === 'completed' || state.status === 'failed') {
      // Generate a unique key for this job result set to prevent re-processing
      const jobKey = `${state.status}-${state.results.length}-${state.items.length}`;
      
      // Skip if we already processed this exact job result
      if (processedJobRef.current === jobKey) {
        return;
      }
      
      const failedResults = state.results.filter(r => r.status === 'error');
      if (failedResults.length > 0 && state.items.length > 0) {
        processedJobRef.current = jobKey;
        failedPostsHook.addFromResults(
          failedResults,
          state.items,
          caption,
          prefixes
        );
      }
    } else {
      // Reset when a new job starts
      processedJobRef.current = null;
    }
  }, [state.status, state.results, state.items, caption, prefixes, failedPostsHook.addFromResults]);

  // Handle retry for a single failed post
  const handleRetryFailedPost = useCallback(async (postId: string) => {
    const post = failedPostsHook.state.posts.find(p => p.id === postId);
    if (!post) return;

    setIsRetrying(true);
    try {
      // Mark as retrying
      failedPostsHook.retryOne(post.id);

      const effectiveTitle = post.customTitle ?? post.originalCaption;
      const effectiveBody = post.customBody ?? post.originalItem.text;

      const retryInput: RetryItemInput = {
        subreddit: post.subreddit,
        flairId: post.flairId,
        titleSuffix: post.titleSuffix,
        customTitle: post.customTitle ?? post.originalItem.customTitle,
        kind: post.originalItem.kind,
        url: post.originalItem.url,
        text: effectiveBody,
        file: post.originalItem.file,
        files: post.originalItem.files,
      };

      const jobId = await retryItem(retryInput, effectiveTitle, post.originalPrefixes);
      if (!jobId) {
        failedPostsHook.markFailed(post.id, 'Failed to submit retry');
      }
      // Job submitted - success/failure will be handled via queue state
    } catch (error) {
      failedPostsHook.markFailed(post.id, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsRetrying(false);
    }
  }, [failedPostsHook, retryItem]);

  // Handle opening the edit dialog
  const handleEditFailedPost = useCallback((post: FailedPost) => {
    setEditingPost(post);
  }, []);

  // Handle submitting an edited failed post
  const handleSubmitEditedPost = useCallback(async (updates: { flairId?: string; titleSuffix?: string; customTitle?: string; customBody?: string }) => {
    if (!editingPost) return;

    setIsRetrying(true);
    try {
      // First update the failed post with new values
      failedPostsHook.updatePost(editingPost.id, updates);

      const effectiveTitle = updates.customTitle ?? editingPost.customTitle ?? editingPost.originalCaption;
      const effectiveBody = updates.customBody ?? editingPost.customBody ?? editingPost.originalItem.text;

      // Mark as retrying
      failedPostsHook.retryOne(editingPost.id);

      // Then retry with the updated values
      const retryInput: RetryItemInput = {
        subreddit: editingPost.subreddit,
        flairId: updates.flairId ?? editingPost.flairId,
        titleSuffix: updates.titleSuffix ?? editingPost.titleSuffix,
        customTitle: updates.customTitle ?? editingPost.customTitle ?? editingPost.originalItem.customTitle,
        kind: editingPost.originalItem.kind,
        url: editingPost.originalItem.url,
        text: effectiveBody,
        file: editingPost.originalItem.file,
        files: editingPost.originalItem.files,
      };

      const jobId = await retryItem(retryInput, effectiveTitle, editingPost.originalPrefixes);
      if (!jobId) {
        failedPostsHook.markFailed(editingPost.id, 'Failed to submit retry');
      }

      setEditingPost(null);
    } catch (error) {
      failedPostsHook.markFailed(editingPost.id, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsRetrying(false);
    }
  }, [editingPost, failedPostsHook, retryItem]);

  // Handle remove failed post
  const handleRemoveFailedPost = useCallback((postId: string) => {
    failedPostsHook.remove(postId);
  }, [failedPostsHook]);

  // Handle retry by category
  const handleRetryByCategory = useCallback(async (category: ErrorCategory) => {
    const postsToRetry = failedPostsHook.retryByCategory(category);
    if (postsToRetry.length === 0) return;

    setIsRetrying(true);
    try {
      const retryInputs: RetryItemInput[] = postsToRetry.map(post => ({
        subreddit: post.subreddit,
        flairId: post.flairId,
        titleSuffix: post.titleSuffix,
        customTitle: post.customTitle ?? post.originalItem.customTitle,
        kind: post.originalItem.kind,
        url: post.originalItem.url,
        text: post.customBody ?? post.originalItem.text,
        file: post.originalItem.file,
        files: post.originalItem.files,
      }));

      const titles = postsToRetry.map(post => post.customTitle ?? post.originalCaption);
      const uniqueTitles = new Set(titles);

      let jobId: string | null = null;
      if (uniqueTitles.size === 1) {
        const firstPost = postsToRetry[0];
        jobId = await retryItems(retryInputs, titles[0], firstPost.originalPrefixes);
      } else {
        for (const post of postsToRetry) {
          const input = retryInputs.find(i => i.subreddit === post.subreddit);
          if (!input) continue;
          const singleJobId = await retryItem(
            input,
            post.customTitle ?? post.originalCaption,
            post.originalPrefixes
          );
          if (!singleJobId) {
            failedPostsHook.markFailed(post.id, 'Failed to submit retry');
          }
        }
        return;
      }

      if (!jobId) {
        postsToRetry.forEach(post => {
          failedPostsHook.markFailed(post.id, 'Failed to submit retry');
        });
      }
    } catch (error) {
      postsToRetry.forEach(post => {
        failedPostsHook.markFailed(post.id, error instanceof Error ? error.message : 'Unknown error');
      });
    } finally {
      setIsRetrying(false);
    }
  }, [failedPostsHook, retryItems]);

  // Handle remove by category
  const handleRemoveByCategory = useCallback((category: ErrorCategory) => {
    failedPostsHook.removeByCategory(category);
  }, [failedPostsHook]);

  // Handle bulk retry all failed posts
  const handleRetryAllFailed = useCallback(async () => {
    const retryablePosts = failedPostsHook.retryAll();
    if (retryablePosts.length === 0) return;

    setIsRetrying(true);
    try {
      const retryInputs: RetryItemInput[] = retryablePosts.map(post => ({
        subreddit: post.subreddit,
        flairId: post.flairId,
        titleSuffix: post.titleSuffix,
        customTitle: post.customTitle ?? post.originalItem.customTitle,
        kind: post.originalItem.kind,
        url: post.originalItem.url,
        text: post.customBody ?? post.originalItem.text,
        file: post.originalItem.file,
        files: post.originalItem.files,
      }));

      const titles = retryablePosts.map(post => post.customTitle ?? post.originalCaption);
      const uniqueTitles = new Set(titles);

      let jobId: string | null = null;
      if (uniqueTitles.size === 1) {
        // Use the first post's caption and prefixes (they should all be the same from a single job)
        const firstPost = retryablePosts[0];
        jobId = await retryItems(retryInputs, titles[0], firstPost.originalPrefixes);
      } else {
        for (const post of retryablePosts) {
          const input = retryInputs.find(i => i.subreddit === post.subreddit);
          if (!input) continue;
          const singleJobId = await retryItem(
            input,
            post.customTitle ?? post.originalCaption,
            post.originalPrefixes
          );
          if (!singleJobId) {
            failedPostsHook.markFailed(post.id, 'Failed to submit retry');
          }
        }
        return;
      }

      if (!jobId) {
        // Mark all as failed
        retryablePosts.forEach(post => {
          failedPostsHook.markFailed(post.id, 'Failed to submit retry');
        });
      }
    } catch (error) {
      // Mark all as failed
      failedPostsHook.state.posts.filter(p => p.status === 'retrying').forEach(post => {
        failedPostsHook.markFailed(post.id, error instanceof Error ? error.message : 'Unknown error');
      });
    } finally {
      setIsRetrying(false);
    }
  }, [failedPostsHook, retryItems]);

  // Handle clear all failed posts
  const handleClearAllFailed = useCallback(() => {
    failedPostsHook.clearAll();
  }, [failedPostsHook]);

  // Convert queue job state to log entries for the progress list
  const logs: LogEntry[] = state.items.map((item, index) => {
    const result = state.results.find(r => r.index === index);

    let status: LogEntry['status'] = 'queued';
    if (result) {
      status = result.status === 'success' ? 'success' : 'error';
    } else if (index === state.currentIndex && state.isProcessing) {
      status = state.waitingSeconds ? 'waiting' : 'posting';
    }

    return {
      index,
      status,
      subreddit: item.subreddit,
      url: result?.url,
      error: result?.error,
    };
  });

  // Derive state flags
  const running = state.isSubmitting || state.isProcessing || state.status === 'processing';
  const completed = state.status === 'completed';
  const cancelled = state.status === 'cancelled';
  const failed = state.status === 'failed';

  // Auto-scroll and focus queue when posting starts
  const queueRef = React.useRef<HTMLDivElement | null>(null);
  const prevRunningRef = React.useRef<boolean>(false);
  useEffect(() => {
    if (!prevRunningRef.current && running) {
      queueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      queueRef.current?.focus({ preventScroll: true });
    }
    prevRunningRef.current = running;
  }, [running]);

  // Notify parent when results are available (for failed post tracking)
  const prevStatusRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    // Only notify when status changes to a terminal state
    const isTerminal = completed || cancelled || failed;
    const wasProcessing = prevStatusRef.current === 'processing';
    
    if (isTerminal && wasProcessing && state.results.length > 0 && onResultsAvailable) {
      // Map results to the expected format
      const resultsWithSubreddit = state.results.map(r => ({
        index: r.index,
        status: r.status,
        subreddit: state.items[r.index]?.subreddit || '',
        error: r.error,
        url: r.url,
      }));
      onResultsAvailable(resultsWithSubreddit, items);
    }
    
    prevStatusRef.current = state.status;
  }, [state.status, state.results, state.items, completed, cancelled, failed, onResultsAvailable, items]);

  // Build error object with proper typing
  // Detect limit errors to filter them out from display
  const isLimitError = state.error && (
    state.error.includes('plan allows') ||
    state.error.includes('subreddits at once') ||
    state.error.includes('Upgrade for unlimited')
  );
  
  const error: { message: string; code: string; recoverable: boolean; details?: string; batchIndex?: number } | null = 
    state.error && !isLimitError ? {
      message: state.error,
      code: state.error.includes('Unauthorized') ? 'AUTH_ERROR' :
        state.error.includes('network') ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR',
      recoverable: !state.error.includes('Unauthorized'),
      details: undefined,
      batchIndex: undefined,
    } : null;

  // Current wait for progress display
  const currentWait = state.waitingSeconds ? {
    index: state.currentIndex,
    seconds: state.waitingSeconds,
    remaining: state.waitingSeconds,
  } : null;

  // Calculate file size and batch info for display
  const totalFileSize = calculateItemsFileSize(items);
  const totalBatches = Math.ceil(items.length / QUEUE_LIMITS.MAX_ITEMS_PER_BATCH);
  const batchInfo = {
    totalBatches,
    canProceed: items.length > 0 && items.length <= maxItems,
    validationError: items.length > maxItems
      ? `Free plan: up to ${maxItems} communities per post. Remove some or upgrade.`
      : undefined,
  };

  // Handler to unselect successful items
  const handleUnselectSuccess = () => {
    const successSubreddits = logs
      .filter(l => l.status === 'success')
      .map(l => l.subreddit);
    if (onUnselectSuccessItems && successSubreddits.length > 0) {
      onUnselectSuccessItems(successSubreddits);
      reset();
    }
  };

  const handleResetJobState = useCallback(() => {
    reset();
    failedPostsHook.clearAll();
  }, [reset, failedPostsHook]);

  const handleButtonClick = async () => {
    if (completed || failed || error) {
      handleResetJobState();
    } else if (!running) {
      // Check if onPostAttempt allows proceeding (returns false to block)
      if (onPostAttempt) {
        try {
          const canProceed = onPostAttempt();
          if (!canProceed) {
            return;
          }
        } catch {
          return; // Abort on error
        }
      }
      await submit({
        items,
        caption,
        prefixes,
      });
    }
  };

  const handleCancel = async () => {
    await cancel();
  };

  const handleRetry = async () => {
    reset();
    // Check if onPostAttempt allows proceeding (returns false to block)
    if (onPostAttempt) {
      try {
        const canProceed = onPostAttempt();
        if (!canProceed) {
          return;
        }
      } catch {
        return; // Abort on error
      }
    }
    await submit({
      items,
      caption,
      prefixes,
    });
  };

  const handleMobileReset = useCallback(() => {
    reset();
    if (onResetMedia) {
      onResetMedia();
    }
  }, [reset, onResetMedia]);

  const handleMobileResetAll = useCallback(() => {
    handleResetJobState();
    if (onClearAll) {
      onClearAll();
    }
  }, [handleResetJobState, onClearAll]);

  const handleDesktopResetAll = useCallback(() => {
    handleResetJobState();
    if (onClearAll) {
      onClearAll();
    }
  }, [handleResetJobState, onClearAll]);

  // Get the appropriate error icon based on error type
  const getErrorIcon = () => {
    if (error?.message?.includes('network') || error?.message?.includes('connect')) {
      return <WifiOff className="h-5 w-5 flex-shrink-0" aria-hidden="true" />;
    }
    if (error?.message?.includes('auth') || error?.message?.includes('login') || error?.message?.includes('Unauthorized')) {
      return <LogIn className="h-5 w-5 flex-shrink-0" aria-hidden="true" />;
    }
    return <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />;
  };

  // Check if auth error
  const isAuthError = error?.code === 'AUTH_ERROR';

  // Determine if error is recoverable
  const isRecoverable = error?.recoverable !== false;

  const isReviewEntry = mode === 'review-entry';
  const handleMobilePost = onReviewRequest ?? handleButtonClick;
  const hasValidationBlockers = hasFlairErrors || !validation.canSubmit;

  useEffect(() => {
    if (onPostActionReady) {
      onPostActionReady(handleButtonClick);
    }
  }, [onPostActionReady, handleButtonClick]);

  return (
    <div className="space-y-4" ref={queueRef} tabIndex={-1}>
      {/* Posting Queue Header - Visible when posting starts */}
      {(running || logs.length > 0) && (
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base lg:text-lg font-semibold tracking-tight pt-1 lg:pt-2">Ready to post</h3>
            {items.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                {items.length}
              </span>
            )}
          </div>
          {running && (
            <p className="text-xs sm:text-sm text-muted-foreground">
              Posting can take a few minutes. Please keep this tab open and wait.
            </p>
          )}
        </div>
      )}

      
      {/* Error Banner - Mobile Friendly (Keep visible on mobile as it's important) */}
      {error && (
        <div
          className="rounded-md bg-red-600/20 border border-red-600/30 p-4 text-red-400"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              {getErrorIcon()}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base">{error.message}</p>
                {error.details && error.code !== 'AUTH_ERROR' && (
                  <p className="text-xs text-red-400/70 mt-1 break-words">
                    {error.details}
                  </p>
                )}
                {error.batchIndex !== undefined && (
                  <p className="text-xs text-red-400/70 mt-1">
                    Failed at round {error.batchIndex + 1}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {error.code === 'AUTH_ERROR' ? (
                <Button
                  onClick={() => router.push('/login')}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer border-red-600/50 text-red-400 hover:bg-red-600/20"
                  aria-label="Go to login page"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign in again
                </Button>
              ) : isRecoverable ? (
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer border-red-600/50 text-red-400 hover:bg-red-600/20"
                  aria-label="Retry posting"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              ) : null}
              <Button
                onClick={handleResetJobState}
                variant="ghost"
                size="sm"
                className="cursor-pointer text-red-400/70 hover:text-red-400 hover:bg-red-600/10"
                aria-label="Close"
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-flight Validation Warnings */}
      {showValidationWarnings && (
        <ValidationWarnings
          result={validation.result}
          onDismiss={validation.canSubmit ? () => setValidationDismissed(true) : undefined}
        />
      )}

      {/* Action Buttons (Hidden on review-entry) */}
      {!isReviewEntry && (
      <div className="hidden lg:flex gap-2">
        {/* Reset Button - Icon only, next to Post button */}
        {!running && !completed && items.length > 0 && onClearAll && (
          <Button
            onClick={onClearAll}
            variant="outline"
            size="icon"
            className="cursor-pointer text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10 shrink-0"
            aria-label="Reset all selections"
            title="Reset all selections"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}

        <Button
          onClick={handleButtonClick}
          disabled={
            (running && !cancelled) ||
            items.length === 0 ||
            hasFlairErrors ||
            !batchInfo.canProceed ||
            state.isSubmitting ||
            !validation.canSubmit
          }
          className="flex-1 cursor-pointer"
          aria-label={
            completed ? 'Reset queue' :
              error ? 'Clear error and reset' :
                cancelled ? 'Retry posting' :
                  failed ? 'Reset and retry' :
                    running ? 'Posting in progress' :
                      state.isSubmitting ? 'Submitting...' :
                        !batchInfo.canProceed ? 'Fix issues above' :
                          !validation.canSubmit ? 'Fix validation issues above' :
                            `Post to ${items.length} communities`
          }
        >
          {completed ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Post again
            </>
          ) : error || failed ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Post again
            </>
          ) : cancelled ? (
            <>
              <XCircle className="h-4 w-4 mr-2" />
              Try again
            </>
          ) : state.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : running ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Posting ({state.currentIndex}/{state.items.length})
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {items.length > 0 ? (
                <>
                  Post to {items.length} {items.length === 1 ? 'community' : 'communities'}
                </>
              ) : (
                'Choose communities'
              )}
            </>
          )}
        </Button>

        {running && !state.isSubmitting && (
          <Button
            onClick={handleCancel}
            variant="outline"
            className="cursor-pointer"
            aria-label="Stop posting"
          >
            <X className="h-4 w-4 mr-2" />
            Stop
          </Button>
        )}
      </div>
      )}

      {/* Empty State */}
      {!isReviewEntry && items.length === 0 && !running && !completed && !cancelled && !error && (
        <div className="text-center py-6 text-muted-foreground hidden lg:block">
          <Send className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
          <p className="text-sm">Pick communities above, then post</p>
        </div>
      )}

      {/* Progress Log */}
      {(running || logs.length > 0) && (
        <QueueProgressList
          logs={logs}
          running={running}
          itemsCount={items.length}
          currentWait={currentWait}
          startedAtMs={state.startedAtMs}
          endedAtMs={state.endedAtMs}
          onUnselectSuccess={onUnselectSuccessItems ? handleUnselectSuccess : undefined}
        />
      )}

      {/* Success Message */}
      {completed && failedPostsHook.state.posts.length === 0 && (
        <div className="rounder-md bg-green-600/20 border border-green-600/30 p-3 text-green-500 hidden lg:block">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">All done!</span>
            </div>
            <Button
              onClick={handleDesktopResetAll}
              variant="outline"
              size="sm"
              className="cursor-pointer border-green-600/40 text-green-200 hover:text-green-100 hover:bg-green-600/20"
              aria-label="Reset post"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reset
            </Button>
          </div>
        </div>
      )}

      {/* Failed Posts Panel - Shows when there are failed posts to manage */}
      {failedPostsHook.state.posts.length > 0 && !running && (
        <FailedPostsPanel
          state={failedPostsHook.state}
          onRetryOne={handleRetryFailedPost}
          onRetryCategory={handleRetryByCategory}
          onRetryAll={handleRetryAllFailed}
          onEdit={handleEditFailedPost}
          onRemove={handleRemoveFailedPost}
          onRemoveCategory={handleRemoveByCategory}
          onClearAll={handleClearAllFailed}
          successCount={logs.filter(l => l.status === 'success').length}
        />
      )}

      {/* Edit Failed Post Dialog */}
      {editingPost && (
        <EditFailedPostDialog
          post={editingPost}
          flairOptions={editFlairOptions}
          flairLoading={editFlairLoading}
          flairRequired={editFlairRequired}
          onSubmit={handleSubmitEditedPost}
          onCancel={() => setEditingPost(null)}
          isRetrying={isRetrying}
        />
      )}

      {/* Cancelled Message */}
      {cancelled && !error && (
        <div className="rounded-md bg-yellow-600/20 border border-yellow-600/30 p-3 text-yellow-500 hidden lg:block">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5" aria-hidden="true" />
            <span className="font-medium">Stopped</span>
          </div>
        </div>
      )}

      {/* Failed Message */}
      {failed && !error && failedPostsHook.state.posts.length === 0 && (
        <div className="rounded-md bg-red-600/20 border border-red-600/30 p-3 text-red-500 hidden lg:block">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5" aria-hidden="true" />
            <span className="font-medium">Something went wrong</span>
          </div>
        </div>
      )}

      {/* Spacer for Mobile Sticky Queue */}
      {/* <div className="min-h-[calc(2rem+env(safe-area-inset-bottom,0px))] lg:min-h-0 lg:h-0" aria-hidden="true" /> */}

      {/* Mobile Sticky Queue Footer */}
      {!hideMobileBar && (
        <MobileStickyQueue
          items={items}
          isPosting={running}
          isCompleted={completed}
          hasErrors={hasFlairErrors || !batchInfo.canProceed || !validation.canSubmit}
          allowErrorNavigation={isReviewEntry && hasValidationBlockers}
          ctaLabel={hasValidationBlockers ? 'Fix errors' : 'Review & post'}
          onPostClick={handleMobilePost}
          onResetClick={handleMobileResetAll}
          onStopClick={handleCancel}
          onClearClick={onClearAll}
        />
      )}
    </div>
  );
});

PostingQueue.displayName = 'PostingQueue';

export default PostingQueue;
