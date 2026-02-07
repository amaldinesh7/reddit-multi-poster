import React, { useState } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { Loader2, CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { LogEntry, CurrentWait } from './types';

interface QueueLogEntryProps {
  entry: LogEntry;
  currentWait: CurrentWait | null;
}

const QueueLogEntry: React.FC<QueueLogEntryProps> = ({ entry, currentWait }) => {
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  // Check if this entry is currently waiting (after success, before next post)
  const isWaitingAfterSuccess = currentWait?.index === entry.index && entry.status === 'success';
  // Check if this entry is the one being waited on (status is 'waiting')
  const isWaitingStatus = entry.status === 'waiting';
  const isWaiting = isWaitingAfterSuccess || isWaitingStatus;
  const isError = entry.status === 'error';

  const getStatusIcon = () => {
    if (isWaiting) {
      return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" aria-label="Waiting" />;
    }
    switch (entry.status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" aria-label="Success" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" aria-label="Error" />;
      case 'posting':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" aria-label="Posting" />;
      case 'waiting':
        return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" aria-label="Waiting" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground/50" aria-label="Queued" />;
    }
  };

  const getSubredditDisplay = () => {
    return entry.subreddit?.startsWith('u_') 
      ? `u/${entry.subreddit.substring(2)}` 
      : `r/${entry.subreddit}`;
  };

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <div className="px-3 py-2 flex items-center gap-2">
        {getStatusIcon()}
        
        <span className={`text-sm flex-1 truncate ${isError ? 'text-red-400' : ''}`}>
          {getSubredditDisplay()}
        </span>
        
        {/* Waiting indicator - countdown timer */}
        {isWaiting && currentWait && (
          <span className="text-xs text-amber-500 tabular-nums">
            next in {currentWait.remaining}s
          </span>
        )}
        
        {/* Error - icon with tooltip */}
        {isError && entry.error && (
          <Tooltip content={entry.error} side="left">
            <button
              type="button"
              onClick={() => setShowErrorDetails(prev => !prev)}
              className="p-1 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
              aria-label={`Error: ${entry.error}`}
              aria-expanded={showErrorDetails}
            >
              <AlertCircle 
                className="h-4 w-4 text-red-500" 
                aria-hidden="true"
              />
            </button>
          </Tooltip>
        )}
        
        {/* Success link */}
        {entry.url && (
          <a 
            href={entry.url.startsWith('//') ? `https:${entry.url}` : entry.url} 
            target="_blank" 
            rel="noreferrer"
            className="text-green-500 hover:text-green-400 p-1 rounded hover:bg-green-500/10 transition-colors cursor-pointer"
            aria-label={`View post on ${getSubredditDisplay()}`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      {isError && entry.error && showErrorDetails && (
        <div className="px-3 pb-2 text-xs text-red-400/90">
          {entry.error}
        </div>
      )}
    </div>
  );
};

export default QueueLogEntry;
