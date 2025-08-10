import React from 'react';
import { Button } from '@/components/ui/button';
// Removed Card import as we're using custom div structure
import { Send, Loader2, CheckCircle, XCircle, X, Info, ExternalLink } from 'lucide-react';

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
    const hasFiles = items.some(item => item.file || (item.files && item.files.length > 0));
    
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
          // Handle different types of messages
          if (json.status === 'started') {
            // Initialize logs with all items in 'posting' state
            const initialLogs = items.map((item, index) => ({
              index,
              status: 'queued',
              subreddit: item.subreddit,
              url: undefined,
              error: undefined
            }));
            setLogs(initialLogs);
          } else if (json.status === 'completed') {
            // Don't add to logs, just let it complete
          } else if (json.status === 'waiting') {
            // Add waiting message as a separate entry
            setLogs((prev) => [...prev, json]);
          } else if (typeof json.index === 'number' && json.subreddit) {
            // Update existing log entry in-place
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
      <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
        <Button
          onClick={completed ? () => { setCompleted(false); setLogs([]); } : start}
          disabled={(running && !abortController) || items.length === 0}
          className={`h-11 sm:h-12 px-6 sm:px-8 font-medium w-full sm:w-auto rounded-lg text-sm sm:text-base ${completed ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
          size="default"
        >
          {completed ? (
            <>
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              <span className="hidden sm:inline">All Done! Click to Reset</span>
              <span className="sm:hidden">Reset</span>
            </>
          ) : cancelled ? (
            <>
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              <span className="hidden sm:inline">Cancelled - Click to Retry</span>
              <span className="sm:hidden">Retry</span>
            </>
          ) : running ? (
            <>
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-spin" />
              <span className="hidden sm:inline">Posting to {items.length} communities...</span>
              <span className="sm:hidden">Posting to {items.length}...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              {items.length > 0 ? (
                <>
                  <span className="hidden sm:inline">Post to {items.length} Subreddit{items.length !== 1 ? 's' : ''}</span>
                  <span className="sm:hidden">Post to {items.length}</span>
                </>
              ) : (
                <span>Post</span>
              )}
            </>
          )}
        </Button>
        
        {running && (
          <Button
            onClick={cancel}
            variant="outline"
            className="h-11 sm:h-12 px-4 sm:px-6 rounded-lg border-red-300 text-red-600 hover:bg-red-600 hover:text-white text-sm sm:text-base w-full sm:w-auto"
            size="default"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <span className="hidden sm:inline">Stop</span>
            <span className="sm:hidden">Stop</span>
          </Button>
        )}
      </div>

      {(running || logs.length > 0 || completed || cancelled) && (
        <div className="border rounded-lg bg-card">
          <div className="px-3 sm:px-4 py-3 border-b bg-muted/30 rounded-t-lg">
            <div className="text-sm font-medium">Progress Log</div>
          </div>
          <div className="p-3 sm:p-4 max-h-64 overflow-y-auto">
            {logs.length === 0 && running && (
              <div className="text-center py-6">
                <div className="text-muted-foreground text-sm">
                  Starting to post...
                </div>
              </div>
            )}
          {logs.map((l, idx) => {
            const entry = l as { subreddit?: string; status?: string; url?: string; error?: string; delaySeconds?: number };
            
            // Handle waiting messages separately
            if (entry.status === 'waiting') {
              return (
                <div key={`waiting-${idx}`} className="py-2 border-b last:border-b-0 bg-blue-50">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-blue-600">
                      Waiting {entry.delaySeconds}s before next post...
                    </span>
                  </div>
                </div>
              );
            }
            
            // Only show subreddit entries
            if (!entry.subreddit) return null;
            
            return (
              <div key={idx} className="py-2 border-b last:border-b-0">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    entry.status === 'success' ? 'bg-green-500' : 
                    entry.status === 'error' ? 'bg-red-500' : 
                    entry.status === 'posting' ? 'bg-blue-500 animate-pulse' : 
                    entry.status === 'queued' ? 'bg-gray-400' : 'bg-gray-500'
                  }`} />
                  
                  {/* Subreddit name */}
                  <span className="font-medium text-foreground text-xs sm:text-sm truncate">
                    r/{entry.subreddit}
                  </span>
                  
                  {/* Status badge */}
                  <div className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                    entry.status === 'success' ? 'bg-green-100 text-green-700' : 
                    entry.status === 'error' ? 'bg-red-100 text-red-700' : 
                    entry.status === 'posting' ? 'bg-blue-100 text-blue-700' : 
                    entry.status === 'queued' ? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {entry.status === 'success' ? '✓' : 
                     entry.status === 'error' ? '✗' : 
                     entry.status === 'posting' ? '⏳' : 
                     entry.status === 'queued' ? '⏸' : '?'}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                    {/* Error info button */}
                    {entry.error && (
                      <div className="relative group">
                        <button className="p-1 hover:bg-red-50 rounded-full transition-colors">
                          <Info className="h-3 w-3 text-red-500" />
                        </button>
                        {/* Tooltip */}
                        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-white border border-red-300 text-red-800 text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 max-w-72 w-max min-w-40">
                          <div className="break-words whitespace-normal leading-relaxed">
                            {entry.error}
                          </div>
                          <div className="absolute top-full right-4 border-4 border-transparent border-t-white"></div>
                          <div className="absolute top-full right-4 mt-px border-4 border-transparent border-t-red-300"></div>
                        </div>
                      </div>
                    )}
                    
                    {/* View link */}
                    {entry.url && (
                      <a 
                        className="p-1 hover:bg-green-50 rounded-full transition-colors" 
                        href={entry.url.startsWith('//') ? `https:${entry.url}` : entry.url} 
                        target="_blank" 
                        rel="noreferrer"
                        title="View post"
                      >
                        <ExternalLink className="h-3 w-3 text-green-600" />
                      </a>
                    )}
                  </div>
                </div>
                
                {/* Mobile-friendly status text */}
                <div className="mt-1 ml-4 sm:hidden">
                  <span className={`text-xs ${
                    entry.status === 'success' ? 'text-green-600' : 
                    entry.status === 'error' ? 'text-red-600' : 
                    entry.status === 'posting' ? 'text-blue-600' : 
                    entry.status === 'queued' ? 'text-gray-600' : 'text-muted-foreground'
                  }`}>
                    {entry.status === 'success' ? 'Posted successfully' : 
                     entry.status === 'error' ? 'Failed to post' : 
                     entry.status === 'posting' ? 'Posting...' : 
                     entry.status === 'queued' ? 'Queued' : entry.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
      
      {completed && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="font-medium text-sm sm:text-base">All posts completed successfully!</span>
          </div>
          <p className="text-xs sm:text-sm text-green-700 mt-1">
            Posted to {items.length} subreddit{items.length !== 1 ? 's' : ''} with your content.
          </p>
        </div>
      )}
      
      {cancelled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="font-medium text-sm sm:text-base">Posting was cancelled</span>
          </div>
          <p className="text-xs sm:text-sm text-yellow-700 mt-1">
            Click the retry button to post to the remaining subreddits.
          </p>
        </div>
      )}
    </div>
  );
} 