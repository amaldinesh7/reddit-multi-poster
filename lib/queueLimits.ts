/**
 * Queue Limits Configuration
 * 
 * Defines constants and utilities for queue validation and batching.
 * These limits ensure reliable posting within platform constraints.
 * 
 * Note: Batch size limits removed - Render supports large payloads (100MB+)
 */

// ============================================================================
// Constants
// ============================================================================

/** Maximum items per batch (keeps processing manageable) */
export const MAX_ITEMS_PER_BATCH = 25;

/** Maximum files per item (Reddit gallery limit) */
export const MAX_FILES_PER_ITEM = 20;

/** Maximum total items in queue */
export const MAX_TOTAL_ITEMS = 100;

/** Maximum single file size in MB (Reddit's limit is ~20MB for images, 1GB for videos) */
export const MAX_SINGLE_FILE_SIZE_MB = 100;

/** Batch timeout in milliseconds (10 minutes - generous for large uploads) */
export const BATCH_TIMEOUT_MS = 600000;

// ============================================================================
// Queue Limits Object (for easy import)
// ============================================================================

export const QUEUE_LIMITS = {
  MAX_ITEMS_PER_BATCH,
  MAX_FILES_PER_ITEM,
  MAX_TOTAL_ITEMS,
  MAX_SINGLE_FILE_SIZE_MB,
  BATCH_TIMEOUT_MS,
} as const;

// ============================================================================
// Types
// ============================================================================

export interface QueueItem {
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

export interface QueueValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface BatchInfo {
  totalBatches: number;
  itemsPerBatch: number[];
  totalFileSize: number;
  canProceed: boolean;
  validationError?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Formats bytes into human-readable file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Calculates the total file size for a set of items
 */
export const calculateItemsFileSize = (items: QueueItem[]): number => {
  let totalSize = 0;
  for (const item of items) {
    if (item.files && item.files.length > 0) {
      totalSize += item.files.reduce((sum, f) => sum + f.size, 0);
    } else if (item.file) {
      totalSize += item.file.size;
    }
  }
  return totalSize;
};

/**
 * Validates the entire queue before processing
 */
export const validateQueue = (items: QueueItem[]): QueueValidationResult => {
  const warnings: string[] = [];

  // Check total items limit
  if (items.length > MAX_TOTAL_ITEMS) {
    return {
      valid: false,
      error: `Maximum ${MAX_TOTAL_ITEMS} items allowed. You have ${items.length}.`,
    };
  }

  if (items.length === 0) {
    return {
      valid: false,
      error: 'No items to post.',
    };
  }

  // Check individual file sizes and file counts
  for (const item of items) {
    const files = item.files || (item.file ? [item.file] : []);
    
    // Check file count per item
    if (files.length > MAX_FILES_PER_ITEM) {
      return {
        valid: false,
        error: `Maximum ${MAX_FILES_PER_ITEM} files per item. r/${item.subreddit} has ${files.length}.`,
      };
    }

    // Check individual file sizes
    for (const file of files) {
      const maxSizeBytes = MAX_SINGLE_FILE_SIZE_MB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        return {
          valid: false,
          error: `File "${file.name}" (${formatFileSize(file.size)}) exceeds maximum size of ${MAX_SINGLE_FILE_SIZE_MB}MB.`,
        };
      }
    }
  }

  // Add warnings for large queues
  if (items.length > MAX_ITEMS_PER_BATCH) {
    const batchCount = Math.ceil(items.length / MAX_ITEMS_PER_BATCH);
    warnings.push(`Queue will be processed in ${batchCount} batches for reliability.`);
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

/**
 * Splits items into batches based on item count only
 * No size limits - Render supports large payloads
 */
export const splitIntoBatches = (items: QueueItem[]): QueueItem[][] => {
  if (items.length === 0) return [];

  const batches: QueueItem[][] = [];
  
  for (let i = 0; i < items.length; i += MAX_ITEMS_PER_BATCH) {
    batches.push(items.slice(i, i + MAX_ITEMS_PER_BATCH));
  }

  return batches;
};

/**
 * Gets batch info for UI display
 */
export const getBatchInfo = (items: QueueItem[]): BatchInfo => {
  const validation = validateQueue(items);
  
  if (!validation.valid) {
    return {
      totalBatches: 0,
      itemsPerBatch: [],
      totalFileSize: 0,
      canProceed: false,
      validationError: validation.error,
    };
  }

  const batches = splitIntoBatches(items);
  const totalFileSize = calculateItemsFileSize(items);

  return {
    totalBatches: batches.length,
    itemsPerBatch: batches.map(b => b.length),
    totalFileSize,
    canProceed: true,
    validationError: undefined,
  };
};

/**
 * Calculates the global start index for a batch
 */
export const getBatchStartIndex = (batches: QueueItem[][], batchIndex: number): number => {
  let startIndex = 0;
  for (let i = 0; i < batchIndex; i++) {
    startIndex += batches[i].length;
  }
  return startIndex;
};

/**
 * Creates a timeout promise for batch processing
 */
export const createBatchTimeout = (timeoutMs: number = BATCH_TIMEOUT_MS): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Batch timed out after ${Math.round(timeoutMs / 1000)} seconds`));
    }, timeoutMs);
  });
};

/**
 * Wraps a promise with a timeout
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number = BATCH_TIMEOUT_MS
): Promise<T> => {
  return Promise.race([promise, createBatchTimeout(timeoutMs)]);
};
