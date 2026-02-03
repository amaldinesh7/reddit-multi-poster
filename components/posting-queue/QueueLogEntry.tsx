import React from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { Loader2, CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { LogEntry, CurrentWait } from './types';

interface QueueLogEntryProps {
  entry: LogEntry;
  currentWait: CurrentWait | null;
}

const QueueLogEntry: React.FC<QueueLogEntryProps> = ({ entry, currentWait }) => {
  const isWaiting = currentWait?.index === entry.index && entry.status === 'success';
  const isError = entry.status === 'error';

  const getStatusIcon = () => {
    if (isWaiting) {
      return <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 animate-spin flex-shrink-0" aria-label="Waiting" />;
    }
    switch (entry.status) {
      case 'success':
        return <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" aria-label="Success" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 flex-shrink-0" aria-label="Error" />;
      case 'posting':
        return <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 animate-spin flex-shrink-0" aria-label="Posting" />;
      default:
        return <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground/50 flex-shrink-0" aria-label="Queued" />;
    }
  };

  const getSubredditDisplay = () => {
    return entry.subreddit?.startsWith('u_') 
      ? `u/${entry.subreddit.substring(2)}` 
      : `r/${entry.subreddit}`;
  };

  return (
    <div 
      className="px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 border-b border-border/50 last:border-b-0"
    >
      {getStatusIcon()}
      
      <span className={`text-xs sm:text-sm flex-1 truncate ${isError ? 'text-red-400' : ''}`}>
        {getSubredditDisplay()}
      </span>
      
      {/* Waiting indicator - countdown timer */}
      {isWaiting && currentWait && (
        <span className="text-[10px] sm:text-xs text-amber-500 tabular-nums flex-shrink-0">
          {currentWait.remaining}s
        </span>
      )}
      
      {/* Error - show message on mobile, tooltip on desktop */}
      {isError && entry.error && (
        <>
          {/* Mobile: show truncated error */}
          <span className="sm:hidden text-[10px] text-red-400 truncate max-w-[80px]">
            {entry.error}
          </span>
          {/* Desktop: tooltip */}
          <Tooltip content={entry.error} side="left">
            <AlertCircle 
              className="hidden sm:block h-4 w-4 text-red-500 cursor-pointer flex-shrink-0" 
              aria-label={`Error: ${entry.error}`}
            />
          </Tooltip>
        </>
      )}
      
      {/* Success link */}
      {entry.url && (
        <a 
          href={entry.url.startsWith('//') ? `https:${entry.url}` : entry.url} 
          target="_blank" 
          rel="noreferrer"
          className="text-green-500 hover:text-green-400 active:text-green-300 p-1.5 sm:p-1 rounded hover:bg-green-500/10 active:bg-green-500/20 transition-colors cursor-pointer tap-highlight-none flex-shrink-0"
          aria-label={`View post on ${getSubredditDisplay()}`}
        >
          <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </a>
      )}
    </div>
  );
};

export default QueueLogEntry;
