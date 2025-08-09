import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Loader2 } from 'lucide-react';

interface Item {
  subreddit: string;
  flairId?: string;
  kind: 'self' | 'link' | 'image' | 'video';
  url?: string;
  text?: string;
  file?: File;
}

interface Props {
  items: Item[];
  caption: string;
  prefixes: { f?: boolean; c?: boolean; oc?: boolean };
}

export default function PostingQueue({ items, caption, prefixes }: Props) {
  const [logs, setLogs] = React.useState<Record<string, unknown>[]>([]);
  const [running, setRunning] = React.useState(false);

  const start = async () => {
    setRunning(true);
    setLogs([]);
    
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
        if (item.file) {
          formData.append(`file_${index}`, item.file);
        }
      });
      
      res = await fetch('/api/queue', {
        method: 'POST',
        body: formData,
      });
    } else {
      // Use JSON for URL/text-only posts
      res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, caption, prefixes }),
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
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Button
          onClick={start}
          disabled={running || items.length === 0}
          className="h-11 px-8 font-medium"
          size="default"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Posting to {items.length} subreddits...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Post to {items.length} Subreddit{items.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 max-h-64 overflow-y-auto">
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Progress will appear here when posting starts
            </p>
          )}
          {logs.map((l, idx) => {
            const entry = l as { subreddit?: string; status?: string; url?: string; error?: string; delaySeconds?: number };
            const statusColor = entry.status === 'success' ? 'text-green-600' : 
                               entry.status === 'error' ? 'text-red-600' : 
                               entry.status === 'waiting' ? 'text-blue-600' : 'text-muted-foreground';
            return (
              <div key={idx} className={`text-sm py-2 border-b last:border-b-0 ${statusColor}`}>
                {entry.status === 'waiting' ? (
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    ⏳ Waiting {entry.delaySeconds}s before next post...
                  </span>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        entry.status === 'success' ? 'bg-green-500' : 
                        entry.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <span className="font-medium text-foreground">r/{entry.subreddit}</span>
                      <span className={statusColor}>
                        {entry.status === 'success' ? '✓ Posted' : 
                         entry.status === 'error' ? '✗ Failed' : entry.status}
                      </span>
                      {entry.url && (
                        <a 
                          className="underline ml-2 text-primary hover:text-primary/80" 
                          href={entry.url.startsWith('//') ? `https:${entry.url}` : entry.url} 
                          target="_blank" 
                          rel="noreferrer"
                        >
                          view post
                        </a>
                      )}
                      {entry.error && <span className="ml-2 text-red-600">{entry.error}</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
} 