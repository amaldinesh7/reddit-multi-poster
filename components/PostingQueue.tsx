import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { Send, Loader2, CheckCircle, XCircle, X, ExternalLink, Clock, AlertCircle, RotateCcw } from 'lucide-react';

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

interface LogEntry {
  index: number;
  status: 'queued' | 'posting' | 'success' | 'error' | 'waiting';
  subreddit: string;
  url?: string;
  error?: string;
  waitingSeconds?: number;
}

export default function PostingQueue({ items, caption, prefixes, hasFlairErrors, onPostAttempt, onUnselectSuccessItems }: Props) {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [running, setRunning] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);
  const [currentWait, setCurrentWait] = React.useState<{ index: number; seconds: number; remaining: number } | null>(null);

  const start = async () => {
    if (onPostAttempt) {
      onPostAttempt();
    }
    
    if (hasFlairErrors) {
      return;
    }
    
    if (items.length === 0) {
      return;
    }
    
    setRunning(true);
    setCompleted(false);
    setCancelled(false);
    setLogs([]);
    setCurrentWait(null);
    
    const controller = new AbortController();
    setAbortController(controller);
    
    const hasFiles = items.some(item => item.file || (item.files && item.files.length > 0));
    
    let res: Response;
    if (hasFiles) {
      const formData = new FormData();
      formData.append('items', JSON.stringify(items.map(item => ({
        subreddit: item.subreddit,
        flairId: item.flairId,
        titleSuffix: item.titleSuffix,
        kind: item.kind,
        url: item.url,
        text: item.text,
      }))));
      formData.append('caption', caption);
      formData.append('prefixes', JSON.stringify(prefixes));
      
      items.forEach((item, index) => {
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
        body: JSON.stringify({ items, caption, prefixes }),
        signal: controller.signal,
      });
    }
    
    if (!res.body) {
      setRunning(false);
      return;
    }
    
    const reader = res.body.getReader();
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
          const json = JSON.parse(line);
          
          if (json.status === 'started') {
            const initialLogs: LogEntry[] = items.map((item, index) => ({
              index,
              status: 'queued',
              subreddit: item.subreddit,
              url: undefined,
              error: undefined
            }));
            setLogs(initialLogs);
          } else if (json.status === 'waiting') {
            // Update the current wait indicator with countdown
            setCurrentWait({ index: json.index, seconds: json.delaySeconds, remaining: json.delaySeconds });
          } else if (typeof json.index === 'number' && json.subreddit) {
            // Clear wait when we get a new status for an item
            setCurrentWait(null);
            setLogs((prev) => prev.map(log => {
              if (log.index === json.index && log.subreddit === json.subreddit) {
                return { ...log, ...json };
              }
              return log;
            }));
          }
        } catch (e) {
          console.error('Failed to parse streaming JSON:', line, e);
        }
      }
    }
    
    setRunning(false);
    setAbortController(null);
    setCurrentWait(null);
    
    // Check completion after logs are updated
    setLogs(currentLogs => {
      const successCount = currentLogs.filter(log => log.status === 'success').length;
      if (!cancelled && successCount === items.length) {
        setCompleted(true);
      }
      return currentLogs;
    });
  };
  
  const cancel = () => {
    if (abortController) {
      abortController.abort();
      setCancelled(true);
      setRunning(false);
      setAbortController(null);
      setCurrentWait(null);
    }
  };

  // Countdown timer effect
  React.useEffect(() => {
    if (!currentWait || currentWait.remaining <= 0) return;
    
    const timer = setInterval(() => {
      setCurrentWait(prev => {
        if (!prev || prev.remaining <= 1) return prev;
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [currentWait?.index, currentWait?.seconds]);

  // Handler to unselect successful items
  const handleUnselectSuccess = () => {
    const successSubreddits = logs
      .filter(l => l.status === 'success')
      .map(l => l.subreddit);
    if (onUnselectSuccessItems && successSubreddits.length > 0) {
      onUnselectSuccessItems(successSubreddits);
    }
  };

  const getStatusIcon = (status: string, isWaiting: boolean) => {
    if (isWaiting) {
      return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
    }
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'posting':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground/50" />;
    }
  };

  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount = logs.filter(l => l.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={completed ? () => { setCompleted(false); setLogs([]); } : start}
          disabled={(running && !abortController) || items.length === 0 || hasFlairErrors}
          className="flex-1"
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
          <Button onClick={cancel} variant="outline">
            <X className="h-4 w-4 mr-2" />
            Stop
          </Button>
        )}
      </div>

      {/* Empty State */}
      {items.length === 0 && !running && !completed && !cancelled && (
        <div className="text-center py-6 text-muted-foreground">
          <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select communities to post to</p>
        </div>
      )}

      {/* Progress Log */}
      {(running || logs.length > 0) && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <div className="flex items-center gap-2 text-xs">
                {/* Unselect success button */}
                {successCount > 0 && onUnselectSuccessItems && !running && (
                  <button
                    onClick={handleUnselectSuccess}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Unselect successful posts"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Unselect Successful Posts ({successCount})</span>
                  </button>
                )}
                {errorCount > 0 && (
                  <span className="text-red-500">{errorCount} failed</span>
                )}
                <span className="text-muted-foreground tabular-nums">
                  {successCount}/{items.length}
                </span>
              </div>
            </div>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {logs.length === 0 && running && (
              <div className="text-center py-6">
                <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Starting...</p>
              </div>
            )}
            
            {logs.map((entry) => {
              const isWaiting = currentWait?.index === entry.index && entry.status === 'success';
              const isError = entry.status === 'error';
              
              return (
                <div 
                  key={entry.index} 
                  className="px-3 py-2 flex items-center gap-2 border-b border-border/50 last:border-b-0"
                >
                  {getStatusIcon(entry.status, isWaiting)}
                  
                  <span className={`text-sm flex-1 truncate ${isError ? 'text-red-400' : ''}`}>
                    {entry.subreddit?.startsWith('u_') 
                      ? `u/${entry.subreddit.substring(2)}` 
                      : `r/${entry.subreddit}`}
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
                      <AlertCircle className="h-4 w-4 text-red-500 cursor-pointer" />
                    </Tooltip>
                  )}
                  
                  {/* Success link */}
                  {entry.url && (
                    <a 
                      href={entry.url.startsWith('//') ? `https:${entry.url}` : entry.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-green-500 hover:text-green-400 p-1 rounded hover:bg-green-500/10 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Success Message */}
      {completed && (
        <div className="rounded-md bg-green-600/20 border border-green-600/30 p-3 text-green-500">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">All posts completed!</span>
          </div>
        </div>
      )}
      
      {/* Cancelled Message */}
      {cancelled && (
        <div className="rounded-md bg-yellow-600/20 border border-yellow-600/30 p-3 text-yellow-500">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Posting cancelled</span>
          </div>
        </div>
      )}
    </div>
  );
}
