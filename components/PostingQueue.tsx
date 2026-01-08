import React from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, CheckCircle, XCircle, X, ExternalLink, Clock } from 'lucide-react';

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
}

export default function PostingQueue({ items, caption, prefixes, hasFlairErrors, onPostAttempt }: Props) {
  const [logs, setLogs] = React.useState<Record<string, unknown>[]>([]);
  const [running, setRunning] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);

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
            const initialLogs = items.map((item, index) => ({
              index,
              status: 'queued',
              subreddit: item.subreddit,
              url: undefined,
              error: undefined
            }));
            setLogs(initialLogs);
          } else if (json.status === 'waiting') {
            setLogs((prev) => [...prev, json]);
          } else if (typeof json.index === 'number' && json.subreddit) {
            setLogs((prev) => prev.map(log => {
              const logEntry = log as any;
              if (logEntry.index === json.index && logEntry.subreddit === json.subreddit) {
                return { ...logEntry, ...json };
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
    
    const finalLogs = logs.filter(log => (log as any).subreddit);
    const successCount = finalLogs.filter(log => (log as any).status === 'success').length;
    const totalCount = items.length;
    
    if (!cancelled && successCount === totalCount) {
      setCompleted(true);
    }
  };
  
  const cancel = () => {
    if (abortController) {
      abortController.abort();
      setCancelled(true);
      setRunning(false);
      setAbortController(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'posting':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

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
              <span className="text-xs text-muted-foreground">
                {logs.filter(l => (l as any).status === 'success').length}/{items.length}
              </span>
            </div>
          </div>
          
          <div className="max-h-48 overflow-y-auto divide-y divide-border">
            {logs.length === 0 && running && (
              <div className="text-center py-6">
                <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Starting...</p>
              </div>
            )}
            
            {logs.map((l, idx) => {
              const entry = l as { subreddit?: string; status?: string; url?: string; error?: string; delaySeconds?: number };
              
              if (entry.status === 'waiting') {
                return (
                  <div key={`waiting-${idx}`} className="px-3 py-2 text-xs text-muted-foreground">
                    Waiting {entry.delaySeconds}s...
                  </div>
                );
              }
              
              if (!entry.subreddit) return null;
              
              return (
                <div key={idx} className="px-3 py-2 flex items-center gap-2">
                  {getStatusIcon(entry.status || '')}
                  <span className="text-sm flex-1 truncate">
                    {entry.subreddit?.startsWith('u_') 
                      ? `u/${entry.subreddit.substring(2)}` 
                      : `r/${entry.subreddit}`}
                  </span>
                  {entry.error && (
                    <span className="text-xs text-red-500 truncate max-w-[150px]" title={entry.error}>
                      {entry.error}
                    </span>
                  )}
                  {entry.url && (
                    <a 
                      href={entry.url.startsWith('//') ? `https:${entry.url}` : entry.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-green-500 hover:text-green-400"
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
