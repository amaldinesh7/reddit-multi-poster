import React from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, CheckCircle, XCircle, X } from 'lucide-react';
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
    start,
    cancel,
    reset,
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
    if (completed) {
      reset();
    } else {
      start();
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleButtonClick}
          disabled={(running && !cancelled) || items.length === 0 || hasFlairErrors}
          className="flex-1 cursor-pointer"
          aria-label={completed ? 'Reset queue' : cancelled ? 'Retry posting' : running ? 'Posting in progress' : `Post to ${items.length} subreddits`}
        >
          {completed ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Done - Reset
            </>
          ) : cancelled ? (
            <>
              <XCircle className="h-4 w-4 mr-2" />
              Retry
            </>
          ) : running ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {items.length > 0 ? `Post to ${items.length} Subreddit${items.length !== 1 ? 's' : ''}` : 'Select Communities'}
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
      {items.length === 0 && !running && !completed && !cancelled && (
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
      {cancelled && (
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
