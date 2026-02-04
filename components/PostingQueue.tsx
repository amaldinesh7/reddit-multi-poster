import React, { useState, useEffect } from 'react';
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
  Info,
  Layers,
  CloudOff,
  Cloud,
  Copy,
  Check,
} from 'lucide-react';
import { useQueueJob } from '../hooks/useQueueJob';
import { QueueProgressList } from './posting-queue';
import { QUEUE_LIMITS, formatFileSize, calculateItemsFileSize } from '@/lib/queueLimits';
import { MobileStickyQueue } from './MobileStickyQueue';
import { LogEntry } from './posting-queue/types';

interface Item {
  subreddit: string;
  flairId?: string;
  titleSuffix?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  text?: string;
  file?: File;
  files?: File[];
}

interface Props {
  items: Item[];
  caption: string;
  prefixes: { f?: boolean; c?: boolean };
  hasFlairErrors?: boolean;
  onPostAttempt?: () => void;
  onUnselectSuccessItems?: (subreddits: string[]) => void;
  onClearAll?: () => void;
  /** Max items allowed (e.g. 5 for paid). Falls back to QUEUE_LIMITS.MAX_TOTAL_ITEMS */
  maxItems?: number;
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
          <span>Batch Progress</span>
        </div>
        <span className="text-xs text-zinc-400">
          {completedBatches} / {totalBatches} batches
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
            title={`Batch ${batch.batchIndex + 1}: ${batch.status}`}
          />
        ))}
      </div>

      {/* Current Batch Info */}
      {currentBatchIndex !== null && batchStates[currentBatchIndex] && (
        <div className="text-xs text-zinc-400 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          <span>
            Processing batch {currentBatchIndex + 1}/{totalBatches}
            {' '}({batchStates[currentBatchIndex].completedItems}/{batchStates[currentBatchIndex].totalItems} items)
          </span>
        </div>
      )}

      {/* Failed Batches Info */}
      {failedBatches > 0 && currentBatchIndex === null && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-red-400">
            {failedBatches} batch{failedBatches !== 1 ? 'es' : ''} failed
          </span>
          {onRetryFailed && (
            <Button
              onClick={onRetryFailed}
              variant="outline"
              size="sm"
              className="h-6 text-xs cursor-pointer border-red-600/50 text-red-400 hover:bg-red-600/20"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry Failed
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Job Status Banner (shows when job is queued)
// ============================================================================

interface JobStatusBannerProps {
  jobId: string;
  status: string;
  isConnected: boolean;
}

const JobStatusBanner: React.FC<JobStatusBannerProps> = ({
  jobId,
  status,
  isConnected,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyJobId = async () => {
    try {
      await navigator.clipboard.writeText(jobId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = jobId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-md bg-blue-600/15 border border-blue-600/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-400">
          <Cloud className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm font-medium">Job Queued</span>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live
            </span>
          ) : (
            <span className="text-xs text-yellow-400 flex items-center gap-1">
              <CloudOff className="h-3 w-3" />
              Reconnecting...
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-blue-300/80">
        Your posts are being processed in the cloud. You can close this tab and come back later.
      </p>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>Job ID:</span>
        <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono text-[10px]">
          {jobId.slice(0, 8)}...
        </code>
        <button
          onClick={handleCopyJobId}
          className="text-zinc-400 hover:text-zinc-300 transition-colors"
          title="Copy job ID"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const PostingQueue: React.FC<Props> = ({
  items,
  caption,
  prefixes,
  hasFlairErrors,
  onPostAttempt,
  onUnselectSuccessItems,
  onClearAll,
  maxItems: maxItemsProp,
}) => {
  const maxItems = maxItemsProp ?? QUEUE_LIMITS.MAX_TOTAL_ITEMS;
  const {
    state,
    submit,
    cancel,
    reset,
  } = useQueueJob();

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
  // Build error object with proper typing
  const error: { message: string; code: string; recoverable: boolean; details?: string; batchIndex?: number } | null = state.error ? {
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
      ? `You can add up to ${maxItems} communities per post. Remove some to continue.`
      : undefined,
  };

  // Handler to unselect successful items
  const handleUnselectSuccess = () => {
    const successSubreddits = logs
      .filter(l => l.status === 'success')
      .map(l => l.subreddit);
    if (onUnselectSuccessItems && successSubreddits.length > 0) {
      onUnselectSuccessItems(successSubreddits);
    }
  };

  const handleButtonClick = async () => {
    if (completed || failed || error) {
      reset();
    } else if (!running) {
      if (onPostAttempt) {
        onPostAttempt();
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
    if (onPostAttempt) {
      onPostAttempt();
    }
    await submit({
      items,
      caption,
      prefixes,
    });
  };

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

  return (
    <div className="space-y-4">
      {/* Posting Queue Header - Visible when posting starts */}
      {(running || logs.length > 0) && (
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-semibold">Posting Queue</h3>
          {items.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
              {items.length}
            </span>
          )}
        </div>
      )}

      

      {/* Job Status Banner (shows when job is queued/processing) */}
      {state.jobId && (running || state.status === 'pending') && (
        <div className="hidden lg:block">
          <JobStatusBanner
            jobId={state.jobId}
            status={state.status || 'pending'}
            isConnected={state.isConnected}
          />
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
                    Failed at batch {error.batchIndex + 1}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {error.code === 'AUTH_ERROR' ? (
                <Button
                  onClick={() => window.location.href = '/login'}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer border-red-600/50 text-red-400 hover:bg-red-600/20"
                  aria-label="Go to login page"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Log In Again
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
                onClick={reset}
                variant="ghost"
                size="sm"
                className="cursor-pointer text-red-400/70 hover:text-red-400 hover:bg-red-600/10"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4 mr-2" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons (Hidden on mobile) */}
      <div className="hidden lg:flex gap-3">
        <Button
          onClick={handleButtonClick}
          disabled={
            (running && !cancelled) ||
            items.length === 0 ||
            hasFlairErrors ||
            !batchInfo.canProceed ||
            state.isSubmitting
          }
          className="flex-1 cursor-pointer"
          aria-label={
            completed ? 'Reset queue' :
              error ? 'Clear error and reset' :
                cancelled ? 'Retry posting' :
                  failed ? 'Reset and retry' :
                    running ? 'Posting in progress' :
                      state.isSubmitting ? 'Submitting...' :
                        !batchInfo.canProceed ? 'Fix validation errors' :
                          `Post to ${items.length} subreddits`
          }
        >
          {completed ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Done - Reset
            </>
          ) : error || failed ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </>
          ) : cancelled ? (
            <>
              <XCircle className="h-4 w-4 mr-2" />
              Retry
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
                  Post to {items.length} Subreddit{items.length !== 1 ? 's' : ''}
                </>
              ) : (
                'Select Communities'
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

        {/* Clear Selection Button (Desktop) */}
        {!running && !completed && items.length > 0 && onClearAll && (
          <Button
            onClick={onClearAll}
            variant="ghost"
            className="cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label="Clear selection"
            title="Clear all selected subreddits"
          >
            <span className="font-serif mr-2 text-lg">🗑️</span>
            Clear
          </Button>
        )}
      </div>

      {/* Empty State */}
      {items.length === 0 && !running && !completed && !cancelled && !error && (
        <div className="text-center py-6 text-muted-foreground hidden lg:block">
          <Send className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
          <p className="text-sm">Select communities to post to</p>
        </div>
      )}

      {/* Progress Log */}
      {(running || logs.length > 0) && (
        <QueueProgressList
          logs={logs}
          running={running}
          itemsCount={items.length}
          currentWait={currentWait}
          onUnselectSuccess={onUnselectSuccessItems ? handleUnselectSuccess : undefined}
        />
      )}

      {/* Success Message */}
      {completed && (
        <div className="rounder-md bg-green-600/20 border border-green-600/30 p-3 text-green-500 hidden lg:block">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" aria-hidden="true" />
            <span className="font-medium">All posts completed!</span>
          </div>
        </div>
      )}

      {/* Cancelled Message */}
      {cancelled && !error && (
        <div className="rounded-md bg-yellow-600/20 border border-yellow-600/30 p-3 text-yellow-500 hidden lg:block">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5" aria-hidden="true" />
            <span className="font-medium">Posting cancelled</span>
          </div>
        </div>
      )}

      {/* Failed Message */}
      {failed && !error && (
        <div className="rounded-md bg-red-600/20 border border-red-600/30 p-3 text-red-500 hidden lg:block">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5" aria-hidden="true" />
            <span className="font-medium">Job failed</span>
          </div>
        </div>
      )}

      {/* Spacer for Mobile Sticky Queue */}
      <div className="h-24 lg:h-0" aria-hidden="true" />

      {/* Mobile Sticky Queue Footer */}
      <MobileStickyQueue
        items={items}
        isPosting={running}
        isCompleted={completed}
        hasErrors={hasFlairErrors || !batchInfo.canProceed}
        onPostClick={handleButtonClick}
        onResetClick={reset}
        onStopClick={handleCancel}
        onClearClick={onClearAll}
      />
    </div>
  );
};

export default PostingQueue;
