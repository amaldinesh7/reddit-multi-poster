/**
 * useFailedPosts Hook
 * 
 * Manages failed posts with persistence and recovery actions.
 * Provides methods to retry, edit, and remove failed posts.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ClassifiedError,
  ErrorCategory,
  classifyError,
  groupErrorsByCategory,
  isRetryable,
  isEditable,
  isPseudoSuccess,
} from '@/lib/errorClassification';
import { QueueJobResult, QueueJobItem } from '@/lib/queueJob';

// ============================================================================
// Types
// ============================================================================

/** Original item data needed for retries */
export interface OriginalItemData {
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  text?: string;
  file?: File;
  files?: File[];
}

export interface FailedPost {
  /** Unique identifier */
  id: string;
  /** Index in the original queue */
  index: number;
  /** Subreddit name */
  subreddit: string;
  /** Selected flair ID (if any) */
  flairId?: string;
  /** Title suffix for this subreddit */
  titleSuffix?: string;
  /** Post type */
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  /** Link URL (for link posts) */
  url?: string;
  /** Text content (for self posts) */
  text?: string;
  /** Classified error information */
  error: ClassifiedError;
  /** Timestamp when the error occurred */
  failedAt: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Current status */
  status: 'failed' | 'retrying' | 'pending';
  /** Original item data needed for retries (contains file refs) */
  originalItem: OriginalItemData;
  /** Original caption used for this post */
  originalCaption: string;
  /** Original prefixes used for this post */
  originalPrefixes: { f?: boolean; c?: boolean };
}

export interface FailedPostsState {
  /** List of failed posts */
  posts: FailedPost[];
  /** Whether there are any failed posts */
  hasFailures: boolean;
  /** Count of posts by category */
  categoryCounts: Record<ErrorCategory, number>;
  /** Posts grouped by category */
  postsByCategory: Record<ErrorCategory, FailedPost[]>;
}

export interface UseFailedPostsReturn {
  /** Current state */
  state: FailedPostsState;
  /** Add failed posts from queue results */
  addFromResults: (
    results: QueueJobResult[], 
    items: QueueJobItem[],
    caption: string,
    prefixes: { f?: boolean; c?: boolean }
  ) => void;
  /** Retry a single post (changes status to 'retrying') */
  retryOne: (id: string) => FailedPost | null;
  /** Retry all retryable posts (changes status to 'retrying') */
  retryAll: () => FailedPost[];
  /** Retry posts by category (changes status to 'retrying') */
  retryByCategory: (category: ErrorCategory) => FailedPost[];
  /** Update a failed post (for edit and retry) */
  updatePost: (id: string, updates: Partial<Pick<FailedPost, 'flairId' | 'titleSuffix'>>) => void;
  /** Remove a single post */
  remove: (id: string) => void;
  /** Remove all posts by category */
  removeByCategory: (category: ErrorCategory) => void;
  /** Remove all failed posts */
  clearAll: () => void;
  /** Mark a post as successfully retried */
  markSuccess: (id: string) => void;
  /** Mark a post as failed (after retry fails) */
  markFailed: (id: string, error: string) => void;
  /** Mark posts as pseudo-success (e.g., duplicates) */
  markPseudoSuccess: () => void;
  /** Load from localStorage */
  loadFromStorage: () => void;
  /** Save to localStorage */
  saveToStorage: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'reddit-multi-poster:failed-posts';
const MAX_STORED_POSTS = 100; // Limit to prevent localStorage bloat

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `fp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function computeCategoryCounts(posts: FailedPost[]): Record<ErrorCategory, number> {
  return {
    fixable_now: posts.filter(p => p.error.category === 'fixable_now').length,
    fixable_later: posts.filter(p => p.error.category === 'fixable_later').length,
    unfixable: posts.filter(p => p.error.category === 'unfixable').length,
  };
}

function computePostsByCategory(posts: FailedPost[]): Record<ErrorCategory, FailedPost[]> {
  return groupErrorsByCategory(posts.map(p => ({ ...p, error: p.error }))) as Record<ErrorCategory, FailedPost[]>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useFailedPosts(): UseFailedPostsReturn {
  const [posts, setPosts] = useState<FailedPost[]>([]);

  // Computed state
  const state = useMemo<FailedPostsState>(() => ({
    posts,
    hasFailures: posts.length > 0,
    categoryCounts: computeCategoryCounts(posts),
    postsByCategory: computePostsByCategory(posts),
  }), [posts]);

  // ============================================================================
  // Load from localStorage on mount
  // ============================================================================

  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPosts(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load failed posts from storage:', error);
    }
  }, []);

  const saveToStorage = useCallback(() => {
    try {
      // Only save the most recent posts to prevent bloat
      const toStore = posts.slice(0, MAX_STORED_POSTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to save failed posts to storage:', error);
    }
  }, [posts]);

  // Auto-save when posts change
  useEffect(() => {
    if (posts.length > 0) {
      saveToStorage();
    } else {
      // Clear storage when no posts
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [posts, saveToStorage]);

  // ============================================================================
  // Add from Results
  // ============================================================================

  const addFromResults = useCallback((
    results: QueueJobResult[], 
    items: QueueJobItem[],
    caption: string,
    prefixes: { f?: boolean; c?: boolean }
  ) => {
    const newFailedPosts: FailedPost[] = [];

    for (const result of results) {
      if (result.status === 'error' && result.error) {
        const item = items[result.index];
        if (!item) continue;

        const classifiedError = classifyError(result.error);

        // Skip duplicates (treat as success)
        if (isPseudoSuccess(classifiedError)) {
          continue;
        }

        newFailedPosts.push({
          id: generateId(),
          index: result.index,
          subreddit: result.subreddit,
          flairId: item.flairId,
          titleSuffix: item.titleSuffix,
          kind: item.kind,
          url: item.url,
          text: item.text,
          error: classifiedError,
          failedAt: result.postedAt || new Date().toISOString(),
          retryCount: 0,
          status: 'failed',
          originalItem: {
            kind: item.kind,
            url: item.url,
            text: item.text,
            file: item.file,
            files: item.files,
          },
          originalCaption: caption,
          originalPrefixes: prefixes,
        });
      }
    }

    if (newFailedPosts.length > 0) {
      setPosts(prev => [...newFailedPosts, ...prev]);
    }
  }, []);

  // ============================================================================
  // Retry Operations
  // ============================================================================

  const retryOne = useCallback((id: string): FailedPost | null => {
    const post = posts.find(p => p.id === id);
    if (!post) return null;

    // Update status to 'retrying' and increment retry count
    setPosts(prev => prev.map(p => 
      p.id === id ? { ...p, status: 'retrying' as const, retryCount: p.retryCount + 1 } : p
    ));

    return post;
  }, [posts]);

  const retryAll = useCallback((): FailedPost[] => {
    const retryablePosts = posts.filter(p => isRetryable(p.error) && p.status !== 'retrying');
    
    // Update status to 'retrying' and increment retry counts
    setPosts(prev => prev.map(p => 
      isRetryable(p.error) && p.status !== 'retrying' 
        ? { ...p, status: 'retrying' as const, retryCount: p.retryCount + 1 } 
        : p
    ));

    return retryablePosts;
  }, [posts]);

  const retryByCategory = useCallback((category: ErrorCategory): FailedPost[] => {
    const categoryPosts = posts.filter(p => p.error.category === category && p.status !== 'retrying');
    
    // Update status to 'retrying' and increment retry counts
    setPosts(prev => prev.map(p => 
      p.error.category === category && p.status !== 'retrying'
        ? { ...p, status: 'retrying' as const, retryCount: p.retryCount + 1 } 
        : p
    ));

    return categoryPosts;
  }, [posts]);

  // ============================================================================
  // Update (Edit)
  // ============================================================================

  const updatePost = useCallback((
    id: string, 
    updates: Partial<Pick<FailedPost, 'flairId' | 'titleSuffix'>>
  ) => {
    setPosts(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates } : p
    ));
  }, []);

  // ============================================================================
  // Remove Operations
  // ============================================================================

  const remove = useCallback((id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  }, []);

  const removeByCategory = useCallback((category: ErrorCategory) => {
    setPosts(prev => prev.filter(p => p.error.category !== category));
  }, []);

  const clearAll = useCallback(() => {
    setPosts([]);
  }, []);

  // ============================================================================
  // Success Handling
  // ============================================================================

  const markSuccess = useCallback((id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  }, []);

  const markFailed = useCallback((id: string, error: string) => {
    const classifiedError = classifyError(error);
    setPosts(prev => prev.map(p => 
      p.id === id ? { ...p, status: 'failed' as const, error: classifiedError } : p
    ));
  }, []);

  const markPseudoSuccess = useCallback(() => {
    // Remove all posts that are pseudo-successes (e.g., duplicates)
    setPosts(prev => prev.filter(p => !isPseudoSuccess(p.error)));
  }, []);

  // Return a stable object reference to prevent infinite re-render loops
  // when consumers include this hook in useEffect/useCallback dependency arrays
  return useMemo(() => ({
    state,
    addFromResults,
    retryOne,
    retryAll,
    retryByCategory,
    updatePost,
    remove,
    removeByCategory,
    clearAll,
    markSuccess,
    markFailed,
    markPseudoSuccess,
    loadFromStorage,
    saveToStorage,
  }), [
    state,
    addFromResults,
    retryOne,
    retryAll,
    retryByCategory,
    updatePost,
    remove,
    removeByCategory,
    clearAll,
    markSuccess,
    markFailed,
    markPseudoSuccess,
    loadFromStorage,
    saveToStorage,
  ]);
}
