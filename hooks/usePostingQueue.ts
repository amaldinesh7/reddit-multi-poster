import { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';

interface QueueItem {
  subreddit: string;
  flairId?: string;
  titleSuffix?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  text?: string;
  file?: File;
  files?: File[];
}

interface LogEntry {
  index: number;
  status: 'queued' | 'posting' | 'success' | 'error' | 'waiting';
  subreddit: string;
  url?: string;
  error?: string;
  waitingSeconds?: number;
}

interface CurrentWait {
  index: number;
  seconds: number;
  remaining: number;
}

interface QueueError {
  message: string;
  code: 'NETWORK_ERROR' | 'AUTH_ERROR' | 'SERVER_ERROR' | 'STREAM_ERROR' | 'UNKNOWN_ERROR';
  details?: string;
}

interface UsePostingQueueProps {
  items: QueueItem[];
  caption: string;
  prefixes: { f?: boolean; c?: boolean };
  hasFlairErrors?: boolean;
  onPostAttempt?: () => void;
}

interface UsePostingQueueReturn {
  logs: LogEntry[];
  running: boolean;
  completed: boolean;
  cancelled: boolean;
  currentWait: CurrentWait | null;
  error: QueueError | null;
  start: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
  clearError: () => void;
}

const getErrorMessage = (error: unknown, code: QueueError['code']): QueueError => {
  const baseError = error instanceof Error ? error : new Error('Unknown error');
  
  switch (code) {
    case 'NETWORK_ERROR':
      return {
        message: 'Unable to connect. Please check your internet connection and try again.',
        code,
        details: baseError.message,
      };
    case 'AUTH_ERROR':
      return {
        message: 'Your session has expired. Please log in again.',
        code,
        details: 'Authentication required',
      };
    case 'SERVER_ERROR':
      return {
        message: 'Something went wrong on our end. Please try again in a moment.',
        code,
        details: baseError.message,
      };
    case 'STREAM_ERROR':
      return {
        message: 'Connection interrupted while posting. Some posts may have been submitted.',
        code,
        details: baseError.message,
      };
    default:
      return {
        message: 'An unexpected error occurred. Please try again.',
        code: 'UNKNOWN_ERROR',
        details: baseError.message,
      };
  }
};

export const usePostingQueue = ({
  items,
  caption,
  prefixes,
  hasFlairErrors,
  onPostAttempt,
}: UsePostingQueueProps): UsePostingQueueReturn => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [currentWait, setCurrentWait] = useState<CurrentWait | null>(null);
  const [error, setError] = useState<QueueError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const start = useCallback(async () => {
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
    setError(null);
    
    const controller = new AbortController();
    setAbortController(controller);
    
    const hasFiles = items.some(item => item.file || (item.files && item.files.length > 0));
    
    // Add Sentry breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: 'posting',
      message: `Starting post queue with ${items.length} items`,
      level: 'info',
      data: {
        itemCount: items.length,
        hasFiles,
        subreddits: items.map(i => i.subreddit),
      },
    });
    
    let res: Response;
    try {
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
    } catch (fetchError) {
      // Check if it was an abort (user cancelled)
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        setCancelled(true);
        setRunning(false);
        setAbortController(null);
        return;
      }
      
      // Network error - capture and report
      const queueError = getErrorMessage(fetchError, 'NETWORK_ERROR');
      setError(queueError);
      setRunning(false);
      setAbortController(null);
      
      Sentry.captureException(fetchError, {
        tags: {
          component: 'usePostingQueue',
          errorType: 'network_error',
          itemCount: items.length,
        },
        extra: {
          subreddits: items.map(i => i.subreddit),
          hasFiles,
        },
      });
      
      return;
    }
    
    // Check for HTTP errors
    if (!res.ok) {
      let errorCode: QueueError['code'] = 'SERVER_ERROR';
      let errorDetails = `HTTP ${res.status}`;
      
      if (res.status === 401) {
        errorCode = 'AUTH_ERROR';
        errorDetails = 'Unauthorized';
      }
      
      try {
        const errorBody = await res.text();
        errorDetails = errorBody || errorDetails;
      } catch {
        // Ignore parse errors
      }
      
      const queueError = getErrorMessage(new Error(errorDetails), errorCode);
      setError(queueError);
      setRunning(false);
      setAbortController(null);
      
      Sentry.captureMessage(`Queue API error: ${res.status}`, {
        level: 'error',
        tags: {
          component: 'usePostingQueue',
          errorType: 'http_error',
          statusCode: res.status,
        },
        extra: {
          subreddits: items.map(i => i.subreddit),
          errorDetails,
        },
      });
      
      return;
    }
    
    if (!res.body) {
      const queueError = getErrorMessage(new Error('No response body'), 'SERVER_ERROR');
      setError(queueError);
      setRunning(false);
      setAbortController(null);
      
      Sentry.captureMessage('Queue API returned no body', {
        level: 'error',
        tags: {
          component: 'usePostingQueue',
          errorType: 'no_body',
        },
      });
      
      return;
    }
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
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
              
              // Track individual post errors in Sentry
              if (json.status === 'error') {
                Sentry.addBreadcrumb({
                  category: 'posting',
                  message: `Post failed for r/${json.subreddit}`,
                  level: 'warning',
                  data: {
                    subreddit: json.subreddit,
                    error: json.error,
                    index: json.index,
                  },
                });
              }
            }
          } catch (parseError) {
            console.error('Failed to parse streaming JSON:', line, parseError);
            Sentry.addBreadcrumb({
              category: 'posting',
              message: 'Failed to parse streaming response',
              level: 'warning',
              data: { line },
            });
          }
        }
      }
    } catch (streamError) {
      // Check if it was an abort
      if (streamError instanceof Error && streamError.name === 'AbortError') {
        setCancelled(true);
      } else {
        // Stream error - some posts may have been submitted
        const queueError = getErrorMessage(streamError, 'STREAM_ERROR');
        setError(queueError);
        
        Sentry.captureException(streamError, {
          tags: {
            component: 'usePostingQueue',
            errorType: 'stream_error',
          },
          extra: {
            subreddits: items.map(i => i.subreddit),
            logsCount: logs.length,
          },
        });
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
        
        // Track successful completion
        Sentry.addBreadcrumb({
          category: 'posting',
          message: `Successfully posted to ${successCount} subreddits`,
          level: 'info',
        });
      }
      return currentLogs;
    });
  }, [items, caption, prefixes, hasFlairErrors, onPostAttempt, cancelled, logs.length]);
  
  const cancel = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setCancelled(true);
      setRunning(false);
      setAbortController(null);
      setCurrentWait(null);
    }
  }, [abortController]);

  const reset = useCallback(() => {
    setCompleted(false);
    setLogs([]);
    setCancelled(false);
    setError(null);
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!currentWait || currentWait.remaining <= 0) return;
    
    const timer = setInterval(() => {
      setCurrentWait(prev => {
        if (!prev || prev.remaining <= 1) return prev;
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [currentWait?.index, currentWait?.seconds]);

  return {
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
  };
};
