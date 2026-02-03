import React from 'react';
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
} from 'lucide-react';
import { usePostingQueue } from '../hooks/usePostingQueue';
import { QueueProgressList } from './posting-queue';
import { QUEUE_LIMITS, formatFileSize, calculateItemsFileSize } from '@/lib/queueLimits';

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
}

// ============================================================================
// Sub-Components
// ============================================================================

interface QueueLimitsBannerProps {
  itemCount: number;
  totalFileSize: number;
  batchCount: number;
  validationError?: string;
}

const QueueLimitsBanner: React.FC<QueueLimitsBannerProps> = ({
  itemCount,
  totalFileSize,
  batchCount,
  validationError,
}) => {
  const hasFiles = totalFileSize > 0;
  const itemProgress = (itemCount / QUEUE_LIMITS.MAX_TOTAL_ITEMS) * 100;

  if (validationError) {
    return (
      <div 
        className="rounded-md bg-red-600/15 border border-red-600/30 p-3"
        role="alert"
      >
        <div className="flex items-start gap-2 text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span className="text-sm">{validationError}</span>
        </div>
      </div>
    );
  }

  if (itemCount === 0) return null;

  return (
    <div className="rounded-md bg-zinc-800/50 border border-zinc-700/50 p-3 space-y-2">
      {/* Item Count Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Items</span>
          <span>{itemCount} / {QUEUE_LIMITS.MAX_TOTAL_ITEMS}</span>
        </div>
        <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              itemProgress > 80 ? 'bg-yellow-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(itemProgress, 100)}%` }}
          />
        </div>
      </div>

      {/* File Size Info (only if files present) */}
      {hasFiles && (
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Total Files</span>
          <span>{formatFileSize(totalFileSize)}</span>
        </div>
      )}

      {/* Batch Info */}
      {batchCount > 1 && (
        <div className="flex items-center gap-2 pt-1 text-xs text-zinc-500">
          <Info className="h-3 w-3" aria-hidden="true" />
          <span>Will be processed in {batchCount} batches</span>
        </div>
      )}
    </div>
  );
};

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
            className={`flex-1 h-2 rounded-full transition-all duration-300 ${
              batch.status === 'completed' 
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
// Main Component
// ============================================================================

const PostingQueue: React.FC<Props> = ({
  items,
  caption,
  prefixes,
  hasFlairErrors,
  onPostAttempt,
  onUnselectSuccessItems
}) => {
  const {
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
  } = usePostingQueue({
    items,
    caption,
    prefixes,
    hasFlairErrors,
    onPostAttempt,
  });

  // Calculate file size for display
  const totalFileSize = calculateItemsFileSize(items);

  // Handler to unselect successful items
  const handleUnselectSuccess = () => {
    const successSubreddits = logs
      .filter(l => l.status === 'success')
      .map(l => l.subreddit);
    if (onUnselectSuccessItems && successSubreddits.length > 0) {
      onUnselectSuccessItems(successSubreddits);
    }
  };

  const handleButtonClick = () => {
    if (completed || error) {
      reset();
    } else {
      start();
    }
  };

  const handleRetry = () => {
    clearError();
    start();
  };

  // Check if we can retry failed batches
  const canRetryFailed = !running && batchStates.some(bs => bs.status === 'failed');

  // Get the appropriate error icon based on error type
  const getErrorIcon = () => {
    switch (error?.code) {
      case 'NETWORK_ERROR':
        return <WifiOff className="h-5 w-5 flex-shrink-0" aria-hidden="true" />;
      case 'AUTH_ERROR':
        return <LogIn className="h-5 w-5 flex-shrink-0" aria-hidden="true" />;
      case 'VALIDATION_ERROR':
        return <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />;
      default:
        return <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />;
    }
  };

  // Determine if error is recoverable
  const isRecoverable = error?.recoverable !== false && error?.code !== 'AUTH_ERROR' && error?.code !== 'VALIDATION_ERROR';

  return (
    <div className="space-y-4">
      {/* Queue Limits Banner */}
      {!running && !completed && !cancelled && (
        <QueueLimitsBanner
          itemCount={items.length}
          totalFileSize={totalFileSize}
          batchCount={batchInfo.totalBatches}
          validationError={batchInfo.validationError}
        />
      )}

      {/* Batch Progress (during/after posting) */}
      {(running || batchStates.length > 1) && (
        <BatchProgress
          batchStates={batchStates}
          currentBatchIndex={currentBatchIndex}
          onRetryFailed={canRetryFailed ? retryFailedBatches : undefined}
        />
      )}

      {/* Error Banner - Mobile Friendly */}
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
                onClick={clearError}
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

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleButtonClick}
          disabled={
            (running && !cancelled) || 
            items.length === 0 || 
            hasFlairErrors || 
            !batchInfo.canProceed
          }
          className="flex-1 cursor-pointer"
          aria-label={
            completed ? 'Reset queue' : 
            error ? 'Clear error and reset' : 
            cancelled ? 'Retry posting' : 
            running ? 'Posting in progress' : 
            !batchInfo.canProceed ? 'Fix validation errors' :
            `Post to ${items.length} subreddits`
          }
        >
          {completed ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Done - Reset
            </>
          ) : error ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </>
          ) : cancelled ? (
            <>
              <XCircle className="h-4 w-4 mr-2" />
              Retry
            </>
          ) : running ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Posting{batchInfo.totalBatches > 1 ? ` (${currentBatchIndex !== null ? currentBatchIndex + 1 : 0}/${batchInfo.totalBatches})` : '...'}
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {items.length > 0 ? (
                <>
                  Post to {items.length} Subreddit{items.length !== 1 ? 's' : ''}
                  {batchInfo.totalBatches > 1 && (
                    <span className="ml-1 opacity-70">
                      ({batchInfo.totalBatches} batches)
                    </span>
                  )}
                </>
              ) : (
                'Select Communities'
              )}
            </>
          )}
        </Button>
        
        {running && (
          <Button 
            onClick={cancel} 
            variant="outline"
            className="cursor-pointer"
            aria-label="Stop posting"
          >
            <X className="h-4 w-4 mr-2" />
            Stop
          </Button>
        )}
      </div>

      {/* Empty State */}
      {items.length === 0 && !running && !completed && !cancelled && !error && (
        <div className="text-center py-6 text-muted-foreground">
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
        <div className="rounded-md bg-green-600/20 border border-green-600/30 p-3 text-green-500">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" aria-hidden="true" />
            <span className="font-medium">All posts completed!</span>
          </div>
        </div>
      )}
      
      {/* Cancelled Message */}
      {cancelled && !error && (
        <div className="rounded-md bg-yellow-600/20 border border-yellow-600/30 p-3 text-yellow-500">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5" aria-hidden="true" />
            <span className="font-medium">Posting cancelled</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostingQueue;
