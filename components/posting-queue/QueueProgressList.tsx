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
      <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 border-b border-border bg-secondary">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs sm:text-sm font-medium">Progress</span>
          <div className="flex items-center gap-2 text-[10px] sm:text-xs">
            {/* Unselect success button - icon only on mobile */}
            {successCount > 0 && onUnselectSuccess && !running && (
              <button
                onClick={onUnselectSuccess}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground active:text-foreground transition-colors cursor-pointer tap-highlight-none p-1 -m-1 rounded"
                title="Unselect successful posts"
                aria-label={`Unselect ${successCount} successful posts`}
              >
                <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Unselect Successful ({successCount})</span>
                <span className="sm:hidden">({successCount})</span>
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
      
      <div className="max-h-48 sm:max-h-64 overflow-y-auto touch-scroll mobile-hide-scrollbar custom-scrollbar">
        {logs.length === 0 && running && (
          <div className="text-center py-4 sm:py-6">
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-2 animate-spin text-primary" aria-label="Starting" />
            <p className="text-xs sm:text-sm text-muted-foreground">Starting...</p>
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
