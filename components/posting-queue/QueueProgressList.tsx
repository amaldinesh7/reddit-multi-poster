import React from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { LogEntry, CurrentWait } from './types';
import QueueLogEntry from './QueueLogEntry';

interface QueueProgressListProps {
  logs: LogEntry[];
  running: boolean;
  itemsCount: number;
  currentWait: CurrentWait | null;
  startedAtMs: number | null;
  endedAtMs: number | null;
  onUnselectSuccess?: () => void;
}

const QueueProgressList: React.FC<QueueProgressListProps> = ({
  logs,
  running,
  itemsCount,
  currentWait,
  startedAtMs,
  endedAtMs,
  onUnselectSuccess,
}) => {
  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount = logs.filter(l => l.status === 'error').length;
  const hasTiming = startedAtMs !== null && endedAtMs !== null && endedAtMs >= startedAtMs;
  const elapsedMs = hasTiming ? endedAtMs - startedAtMs : null;
  const manualSecondsPerPost = 45;
  const estimatedManualMs = itemsCount * manualSecondsPerPost * 1000;
  const savedMs = elapsedMs !== null ? Math.max(0, estimatedManualMs - elapsedMs) : null;

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.round(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-secondary">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{running ? 'Posting' : logs.length > 0 ? 'Results' : 'Progress'}</span>
          <div className="flex items-center gap-2 text-xs">
            {/* Unselect success button */}
            {successCount > 0 && onUnselectSuccess && !running && (
              <button
                onClick={onUnselectSuccess}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Deselect successful posts"
                aria-label={`Deselect ${successCount} that succeeded`}
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear {successCount} successful</span>
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
        {hasTiming && elapsedMs !== null && savedMs !== null && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-emerald-400">That was blazing fast</span>
            <span className="text-foreground/70">Took {formatDuration(elapsedMs)}</span>
            <span className="text-foreground/70">Saved ~{formatDuration(savedMs)}</span>
            {errorCount > 0 && (
              <span className="text-red-400">Retry failed</span>
            )}
          </div>
        )}
      </div>

      <div className="">
        {logs.length === 0 && running && (
          <div className="text-center py-6">
            <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin text-primary" aria-label="Preparing" />
            <p className="text-sm text-muted-foreground">Preparing…</p>
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
