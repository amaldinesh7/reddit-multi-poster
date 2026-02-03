import React from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { LogEntry, CurrentWait } from './types';
import QueueLogEntry from './QueueLogEntry';

interface QueueProgressListProps {
  logs: LogEntry[];
  running: boolean;
  itemsCount: number;
  currentWait: CurrentWait | null;
  onUnselectSuccess?: () => void;
}

const QueueProgressList: React.FC<QueueProgressListProps> = ({
  logs,
  running,
  itemsCount,
  currentWait,
  onUnselectSuccess,
}) => {
  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount = logs.filter(l => l.status === 'error').length;

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-secondary">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Progress</span>
          <div className="flex items-center gap-2 text-xs">
            {/* Unselect success button */}
            {successCount > 0 && onUnselectSuccess && !running && (
              <button
                onClick={onUnselectSuccess}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Unselect successful posts"
                aria-label={`Unselect ${successCount} successful posts`}
              >
                <RotateCcw className="h-3 w-3" />
                <span>Unselect Successful Posts ({successCount})</span>
              </button>
            )}
            {errorCount > 0 && (
              <span className="text-red-500">{errorCount} failed</span>
            )}
            <span className="text-muted-foreground tabular-nums">
              {successCount}/{itemsCount}
            </span>
          </div>
        </div>
      </div>
      
      <div className="max-h-64 overflow-y-auto">
        {logs.length === 0 && running && (
          <div className="text-center py-6">
            <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin text-primary" aria-label="Starting" />
            <p className="text-sm text-muted-foreground">Starting...</p>
          </div>
        )}
        
        {logs.map((entry) => (
          <QueueLogEntry
            key={entry.index}
            entry={entry}
            currentWait={currentWait}
          />
        ))}
      </div>
    </div>
  );
};

export default QueueProgressList;
