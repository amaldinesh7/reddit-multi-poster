import React from 'react';
import { Button } from '@/components/ui/button';
// Removed Card import as we're using custom div structure
import { Send, Loader2, CheckCircle, XCircle, X } from 'lucide-react';

interface Item {
  subreddit: string;
  flairId?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  text?: string;
  file?: File;
  files?: File[]; // Support for multiple files
}

interface Props {
  items: Item[];
  caption: string;
  prefixes: { f?: boolean; c?: boolean };
}

export default function PostingQueue({ items, caption, prefixes }: Props) {
  const [logs, setLogs] = React.useState<Record<string, unknown>[]>([]);
  const [running, setRunning] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);

  const start = async () => {
    if (items.length === 0) {
      return;
    }
    
    setRunning(true);
    setCompleted(false);
    setCancelled(false);
    setLogs([]);
    
    const controller = new AbortController();
    setAbortController(controller);
    
    // Check if any items have files
    const hasFiles = items.some(item => item.file);
    
    let res: Response;
    if (hasFiles) {
      // Use FormData for file uploads
      const formData = new FormData();
      formData.append('items', JSON.stringify(items.map(item => ({
        subreddit: item.subreddit,
        flairId: item.flairId,
        kind: item.kind,
        url: item.url,
        text: item.text,
      }))));
      formData.append('caption', caption);
      formData.append('prefixes', JSON.stringify(prefixes));
      
      // Add files
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
      // Use JSON for URL/text-only posts
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
          console.log('Received streaming data:', json); // Debug log
          // Only add to logs if it's not a system message
          if (json.status !== 'started' && json.status !== 'completed') {
            setLogs((prev) => [...prev, json]);
          }
        } catch (e) {
          console.error('Failed to parse streaming JSON:', line, e);
        }
      }
    }
    setRunning(false);
    setAbortController(null);
    
    // Check if all posts completed successfully
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

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-3">
        <Button
          onClick={completed ? () => { setCompleted(false); setLogs([]); } : start}
          disabled={(running && !abortController) || items.length === 0}
          className={`h-12 px-8 font-medium w-full sm:w-auto rounded-full ${completed ? 'bg-success hover:bg-success/90 text-white' : ''}`}
          size="default"
        >
          {completed ? (
            <>
              <CheckCircle className="h-5 w-5 mr-2" />
              All Done! Click to Reset
            </>
          ) : cancelled ? (
            <>
              <XCircle className="h-5 w-5 mr-2" />
              Cancelled - Click to Retry
            </>
          ) : running ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Posting to {items.length} communities...
            </>
          ) : (
            <>
              <Send className="h-5 w-5 mr-2" />
              Post to {items.length} Subreddit{items.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>
        
        {running && (
          <Button
            onClick={cancel}
            variant="outline"
            className="h-12 px-6 rounded-full border-destructive text-destructive hover:bg-destructive hover:text-white"
            size="default"
          >
            <X className="h-5 w-5 mr-2" />
            Stop
          </Button>
        )}
      </div>

      {(running || logs.length > 0 || completed || cancelled) && (
        <div className="border rounded-lg bg-card">
          <div className="px-4 py-3 border-b bg-muted/30 rounded-t-lg">
            <div className="text-sm font-medium">Progress Log</div>
          </div>
          <div className="p-4 max-h-64 overflow-y-auto">
            {logs.length === 0 && running && (
              <div className="text-center py-6">
                <div className="text-muted-foreground text-sm">
                  Starting to post...
                </div>
              </div>
            )}
          {logs.map((l, idx) => {
            const entry = l as { subreddit?: string; status?: string; url?: string; error?: string; delaySeconds?: number };
            
            // Skip delay messages, show them inline with status
            if (entry.status === 'waiting') {
              return (
                <div key={idx} className="py-2 border-b last:border-b-0">
                  <div className="flex items-center gap-3 text-info">
                    <div className="w-2 h-2 bg-info rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Waiting {entry.delaySeconds}s before next post...</span>
                  </div>
                </div>
              );
            }
            
            // Only show subreddit entries
            if (!entry.subreddit) return null;
            
            const statusColor = entry.status === 'success' ? 'text-green-600' : 
                               entry.status === 'error' ? 'text-red-600' : 
                               entry.status === 'posting' ? 'text-blue-600' : 'text-muted-foreground';
                               
            return (
              <div key={idx} className="text-sm py-2 border-b last:border-b-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    entry.status === 'success' ? 'bg-green-500' : 
                    entry.status === 'error' ? 'bg-red-500' : 
                    entry.status === 'posting' ? 'bg-blue-500 animate-pulse' : 'bg-gray-500'
                  }`} />
                  <span className="font-medium text-foreground">r/{entry.subreddit}</span>
                  <span className={statusColor}>
                    {entry.status === 'success' ? '✓ Posted' : 
                     entry.status === 'error' ? '✗ Failed' : 
                     entry.status === 'posting' ? '⏳ Posting...' : entry.status}
                  </span>
                  {entry.url && (
                    <a 
                      className="underline ml-auto text-primary hover:text-primary/80 text-xs" 
                      href={entry.url.startsWith('//') ? `https:${entry.url}` : entry.url} 
                      target="_blank" 
                      rel="noreferrer"
                    >
                      view
                    </a>
                  )}
                  {entry.error && <span className="ml-auto text-red-600 text-xs truncate max-w-32">{entry.error}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
      
      {completed && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">All posts completed successfully!</span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            Posted to {items.length} subreddit{items.length !== 1 ? 's' : ''} with your content.
          </p>
        </div>
      )}
      
      {cancelled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Posting was cancelled</span>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            You can click the button above to retry posting to the remaining subreddits.
          </p>
        </div>
      )}
    </div>
  );
} 