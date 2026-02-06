/**
 * Queue Job Types
 * 
 * TypeScript types for the Supabase-based job queue system.
 * These types mirror the database schema and define the structure
 * of queue jobs, items, and results.
 */

// ============================================================================
// Status Types
// ============================================================================

export type QueueJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type QueueItemStatus = 'queued' | 'posting' | 'success' | 'error' | 'skipped';

// ============================================================================
// Item Types (stored in queue_jobs.items JSONB)
// ============================================================================

/**
 * Queue item as stored in the database.
 * Does NOT contain File objects - files are stored in Supabase Storage.
 */
export interface QueueJobItem {
  subreddit: string;
  flairId?: string;
  titleSuffix?: string;
  customTitle?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  text?: string;
  // File count for this item (actual files in Storage)
  fileCount?: number;
}

/**
 * File reference stored in queue_jobs.file_paths JSONB.
 * Points to a file in Supabase Storage.
 * 
 * Storage path format: {username}/{date}/job_{shortId}/{prefix}_{fileIndex}_{fileName}
 * 
 * @property itemIndex - Index of the item this file belongs to, or -1 for shared files.
 *                       Shared files (itemIndex = -1) are used by all items in the job.
 *                       This avoids uploading the same media multiple times when posting
 *                       to multiple subreddits.
 * @property fileIndex - Index of the file within the item (for galleries) or shared files.
 * @property storagePath - Full path in Supabase Storage bucket.
 * @property originalName - Original filename uploaded by the user.
 * @property mimeType - MIME type of the file.
 * @property size - File size in bytes.
 */
export interface QueueFileReference {
  /** Item index this file belongs to, or -1 for shared files used by all items */
  itemIndex: number;
  fileIndex: number;
  storagePath: string;
  originalName: string;
  mimeType: string;
  size: number;
}

// ============================================================================
// Result Types (stored in queue_jobs.results JSONB)
// ============================================================================

/**
 * Result of posting a single item.
 */
export interface QueueJobResult {
  index: number;
  subreddit: string;
  status: 'success' | 'error' | 'skipped';
  url?: string;
  error?: string;
  postedAt?: string;
}

// ============================================================================
// Job Types (database row)
// ============================================================================

/**
 * Queue job as stored in the database.
 */
export interface QueueJob {
  id: string;
  user_id: string;
  status: QueueJobStatus;
  caption: string;
  prefixes: { f?: boolean; c?: boolean };
  items: QueueJobItem[];
  file_paths: QueueFileReference[];
  current_index: number;
  results: QueueJobResult[];
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
}

/**
 * Data required to create a new queue job.
 */
export interface CreateQueueJobInput {
  userId: string;
  caption: string;
  prefixes: { f?: boolean; c?: boolean };
  items: QueueJobItem[];
  files: QueueFileReference[];
}

/**
 * Job submission from the frontend (includes File objects).
 */
export interface QueueJobSubmission {
  items: QueueJobItemWithFiles[];
  caption: string;
  prefixes: { f?: boolean; c?: boolean };
}

/**
 * Queue item with actual File objects (frontend only).
 * This is what the frontend sends to the submit endpoint.
 */
export interface QueueJobItemWithFiles {
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

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from POST /api/queue/submit
 */
export interface SubmitJobResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

/**
 * Response from GET /api/queue/status/[jobId]
 */
export interface JobStatusResponse {
  job: QueueJob | null;
  error?: string;
}

/**
 * Response from POST /api/queue/cancel/[jobId]
 */
export interface CancelJobResponse {
  success: boolean;
  error?: string;
}

/**
 * Progress update from GET /api/queue/process (streamed)
 */
export interface JobProgressUpdate {
  type: 'status' | 'progress' | 'result' | 'waiting' | 'complete' | 'error';
  jobId: string;
  status?: QueueJobStatus;
  currentIndex?: number;
  result?: QueueJobResult;
  waitSeconds?: number;
  error?: string;
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * State for the useQueueJob hook.
 */
export interface QueueJobState {
  jobId: string | null;
  status: QueueJobStatus | null;
  items: QueueJobItem[];
  results: QueueJobResult[];
  currentIndex: number;
  error: string | null;
  isSubmitting: boolean;
  isProcessing: boolean;
  isConnected: boolean; // Realtime connection status
}

/**
 * Actions returned by useQueueJob hook.
 */
export interface QueueJobActions {
  submit: (submission: QueueJobSubmission) => Promise<string | null>;
  cancel: () => Promise<boolean>;
  reset: () => void;
}

// ============================================================================
// Constants
// ============================================================================

export const QUEUE_JOB_CONSTANTS = {
  /** How often to poll the process endpoint (ms) */
  POLLING_INTERVAL_MS: 3000,
  
  /** Max time a job can be claimed before it's considered stale (ms) */
  CLAIM_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  
  /** How long to keep completed job files before cleanup (hours) */
  FILE_RETENTION_HOURS: 24,
  
  /** Max concurrent jobs per user (single session model) */
  MAX_JOBS_PER_USER: 1,
  
  /** Storage bucket name */
  STORAGE_BUCKET: 'queue-files',
} as const;
