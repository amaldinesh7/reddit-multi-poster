import { useState, useEffect, useCallback } from 'react';

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
  start: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

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
    
    const controller = new AbortController();
    setAbortController(controller);
    
    const hasFiles = items.some(item => item.file || (item.files && item.files.length > 0));
    
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
    } catch (error) {
      // Request was aborted or failed
      setRunning(false);
      setAbortController(null);
      return;
    }
    
    if (!res.body) {
      setRunning(false);
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
            }
          } catch (e) {
            console.error('Failed to parse streaming JSON:', line, e);
          }
        }
      }
    } catch (error) {
      // Stream was aborted
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
  }, [items, caption, prefixes, hasFlairErrors, onPostAttempt, cancelled]);
  
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
    start,
    cancel,
    reset,
  };
};
