export interface QueueItemData {
  subreddit: string;
  flairId?: string;
  titleSuffix?: string;
  customTitle?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  text?: string;
  file?: File;
  files?: File[];
}

export interface LogEntry {
  index: number;
  status: 'queued' | 'posting' | 'success' | 'error' | 'waiting';
  subreddit: string;
  url?: string;
  error?: string;
  waitingSeconds?: number;
}

export interface CurrentWait {
  index: number;
  seconds: number;
  remaining: number;
}

// ============================================================================
// Batch State Types
// ============================================================================

export type BatchStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BatchState {
  batchIndex: number;
  status: BatchStatus;
  completedItems: number;
  totalItems: number;
  successCount: number;
  errorCount: number;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface BatchInfo {
  totalBatches: number;
  itemsPerBatch: number[];
  totalFileSize: number;
  canProceed: boolean;
  validationError?: string;
}

// ============================================================================
// Queue Error Types
// ============================================================================

export type QueueErrorCode = 
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR' 
  | 'AUTH_ERROR' 
  | 'SERVER_ERROR' 
  | 'STREAM_ERROR'
  | 'TIMEOUT_ERROR'
  | 'BATCH_ERROR'
  | 'UNKNOWN_ERROR';

export interface QueueError {
  message: string;
  code: QueueErrorCode;
  details?: string;
  batchIndex?: number;
  recoverable?: boolean;
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UsePostingQueueReturn {
  logs: LogEntry[];
  running: boolean;
  completed: boolean;
  cancelled: boolean;
  currentWait: CurrentWait | null;
  error: QueueError | null;
  batchInfo: BatchInfo;
  batchStates: BatchState[];
  currentBatchIndex: number | null;
  start: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
  clearError: () => void;
  retryFailedBatches: () => Promise<void>;
}

export interface UsePostingQueueProps {
  items: QueueItemData[];
  caption: string;
  prefixes: { f?: boolean; c?: boolean };
  hasFlairErrors?: boolean;
  onPostAttempt?: () => void;
}
