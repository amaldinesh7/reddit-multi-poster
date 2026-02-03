import React from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, CheckCircle, XCircle, X, AlertTriangle, RefreshCw, WifiOff, LogIn } from 'lucide-react';
import { usePostingQueue } from '../hooks/usePostingQueue';
import { QueueProgressList } from './posting-queue';

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
    start,
    cancel,
    reset,
    clearError,
  } = usePostingQueue({
    items,
    caption,
    prefixes,
    hasFlairErrors,
    onPostAttempt,
  });

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

  // Get the appropriate error icon based on error type
  const getErrorIcon = () => {
    switch (error?.code) {
      case 'NETWORK_ERROR':
        return <WifiOff className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />;
      case 'AUTH_ERROR':
        return <LogIn className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />;
      default:
        return <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Error Banner - Mobile Friendly */}
      {error && (
        <div 
          className="rounded-md bg-red-600/20 border border-red-600/30 p-3 sm:p-4 text-red-400"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex flex-col gap-2.5 sm:gap-3">
            <div className="flex items-start gap-2 sm:gap-3">
              {getErrorIcon()}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs sm:text-sm">{error.message}</p>
                {error.details && error.code !== 'AUTH_ERROR' && (
                  <p className="text-[10px] sm:text-xs text-red-400/70 mt-0.5 sm:mt-1 break-words">
                    {error.details}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {error.code === 'AUTH_ERROR' ? (
                <Button
                  onClick={() => window.location.href = '/login'}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer border-red-600/50 text-red-400 hover:bg-red-600/20 active:bg-red-600/30 h-8 text-xs tap-highlight-none"
                  aria-label="Go to login page"
                >
                  <LogIn className="h-3.5 w-3.5 mr-1.5" />
                  Log In
                </Button>
              ) : (
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer border-red-600/50 text-red-400 hover:bg-red-600/20 active:bg-red-600/30 h-8 text-xs tap-highlight-none"
                  aria-label="Retry posting"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Retry
                </Button>
              )}
              <Button
                onClick={clearError}
                variant="ghost"
                size="sm"
                className="cursor-pointer text-red-400/70 hover:text-red-400 hover:bg-red-600/10 active:bg-red-600/20 h-8 text-xs tap-highlight-none"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 sm:gap-3">
        <Button
          onClick={handleButtonClick}
          disabled={(running && !cancelled) || items.length === 0 || hasFlairErrors}
          className="flex-1 cursor-pointer h-10 sm:h-10 text-xs sm:text-sm tap-highlight-none"
          aria-label={completed ? 'Reset queue' : error ? 'Clear error and reset' : cancelled ? 'Retry posting' : running ? 'Posting in progress' : `Post to ${items.length} subreddits`}
        >
          {completed ? (
            <>
              <CheckCircle className="h-4 w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Done - Reset</span>
              <span className="sm:hidden">Reset</span>
            </>
          ) : error ? (
            <>
              <RefreshCw className="h-4 w-4 mr-1.5 sm:mr-2" />
              Reset
            </>
          ) : cancelled ? (
            <>
              <XCircle className="h-4 w-4 mr-1.5 sm:mr-2" />
              Retry
            </>
          ) : running ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 sm:mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-1.5 sm:mr-2" />
              {items.length > 0 ? (
                <>
                  <span className="hidden sm:inline">Post to {items.length} Subreddit{items.length !== 1 ? 's' : ''}</span>
                  <span className="sm:hidden">Post ({items.length})</span>
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
            className="cursor-pointer h-10 px-3 sm:px-4 tap-highlight-none"
            aria-label="Stop posting"
          >
            <X className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Stop</span>
          </Button>
        )}
      </div>

      {/* Empty State */}
      {items.length === 0 && !running && !completed && !cancelled && !error && (
        <div className="text-center py-4 sm:py-6 text-muted-foreground">
          <Send className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
          <p className="text-xs sm:text-sm">Select communities to post to</p>
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
        <div className="rounded-md bg-green-600/20 border border-green-600/30 p-2.5 sm:p-3 text-green-500">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium text-xs sm:text-sm">All posts completed!</span>
          </div>
        </div>
      )}
      
      {/* Cancelled Message */}
      {cancelled && !error && (
        <div className="rounded-md bg-yellow-600/20 border border-yellow-600/30 p-2.5 sm:p-3 text-yellow-500">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium text-xs sm:text-sm">Posting cancelled</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostingQueue;
