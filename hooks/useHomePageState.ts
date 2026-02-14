import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { QueueItem } from '@/types';
import { usePersistentState } from './usePersistentState';
import type { PerSubredditOverride } from '@/components/subreddit-picker';
import { normalizeSubredditKey } from '@/lib/subredditKey';

// ============================================================================
// Types
// ============================================================================

interface MeData {
  name: string;
  icon_img?: string;
  id?: string;
}

/**
 * Settings saved from the last successful post
 * Used for "Load Last Post Settings" feature
 */
export interface SavedPostSettings {
  subreddits: string[];
  flairs: Record<string, string | undefined>;
  titleSuffixes: Record<string, string | undefined>;
  prefixes: { f: boolean; c: boolean };
  savedAt: string; // ISO timestamp
}

const LAST_POST_SETTINGS_KEY = 'rmp_last_post_settings';

interface UseHomePageStateProps {
  authMe?: MeData;
}

interface UseHomePageStateReturn {
  selectedSubs: string[];
  setSelectedSubs: (value: string[] | ((val: string[]) => string[])) => void;
  caption: string;
  setCaption: (value: string | ((val: string) => string)) => void;
  body: string;
  setBody: (value: string | ((val: string) => string)) => void;
  prefixes: { f: boolean; c: boolean };
  setPrefixes: React.Dispatch<React.SetStateAction<{ f: boolean; c: boolean }>>;
  mediaUrl: string;
  setMediaUrl: (value: string | ((val: string) => string)) => void;
  mediaFiles: File[];
  setMediaFiles: React.Dispatch<React.SetStateAction<File[]>>;
  mediaType: 'image' | 'video' | 'url';
  setMediaType: (value: 'image' | 'video' | 'url' | ((val: 'image' | 'video' | 'url') => 'image' | 'video' | 'url')) => void;
  flairs: Record<string, string | undefined>;
  setFlairs: (value: Record<string, string | undefined> | ((val: Record<string, string | undefined>) => Record<string, string | undefined>)) => void;
  titleSuffixes: Record<string, string | undefined>;
  setTitleSuffixes: (value: Record<string, string | undefined> | ((val: Record<string, string | undefined>) => Record<string, string | undefined>)) => void;
  customTitles: Record<string, string>;
  setCustomTitles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  contentOverrides: Record<string, PerSubredditOverride>;
  setContentOverrides: (value: Record<string, PerSubredditOverride> | ((val: Record<string, PerSubredditOverride>) => Record<string, PerSubredditOverride>)) => void;
  postToProfile: boolean;
  setPostToProfile: React.Dispatch<React.SetStateAction<boolean>>;
  hasFlairErrors: boolean;
  setHasFlairErrors: React.Dispatch<React.SetStateAction<boolean>>;
  showValidationErrors: boolean;
  setShowValidationErrors: React.Dispatch<React.SetStateAction<boolean>>;
  items: QueueItem[];
  handleValidationChange: (hasErrors: boolean) => void;
  handlePostAttempt: () => void;
  handleUnselectSuccessItems: (subreddits: string[]) => void;
  clearSelection: () => void;
  clearAllState: () => void;
  // Last post settings feature
  hasLastPostSettings: boolean;
  lastPostSettingsDate: string | undefined;
  justAppliedLastPost: boolean;
  saveCurrentAsLastPost: () => void;
  applyLastPostSettings: () => void;
}

function normalizeSubredditRecordKeys<T>(input: Record<string, T>): Record<string, T> {
  const output: Record<string, T> = {};

  for (const [rawKey, value] of Object.entries(input)) {
    const normalizedKey = normalizeSubredditKey(rawKey);
    if (!normalizedKey) continue;

    // Canonical lowercase keys take precedence if both variants are present.
    if (rawKey === normalizedKey) {
      output[normalizedKey] = value;
      continue;
    }

    if (!(normalizedKey in output)) {
      output[normalizedKey] = value;
    }
  }

  return output;
}

function areRecordsEqual<T>(a: Record<string, T>, b: Record<string, T>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!(key in b) || a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

export const useHomePageState = ({ authMe }: UseHomePageStateProps): UseHomePageStateReturn => {
  const [selectedSubs, setSelectedSubs] = usePersistentState<string[]>('rmp_selected_subs', []);
  const [caption, setCaption] = usePersistentState<string>('rmp_caption', '');
  const [body, setBody] = usePersistentState<string>('rmp_body', '');
  const [prefixes, setPrefixes] = usePersistentState<{ f: boolean; c: boolean }>('rmp_prefixes', { f: false, c: false });
  const [mediaUrl, setMediaUrl] = usePersistentState<string>('rmp_media_url', '');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaType, setMediaType] = usePersistentState<'image' | 'video' | 'url'>('rmp_media_type', 'image');
  const [flairs, setFlairs] = usePersistentState<Record<string, string | undefined>>('rmp_flairs', {});
  const [titleSuffixes, setTitleSuffixes] = usePersistentState<Record<string, string | undefined>>('rmp_title_suffixes', {});
  const [postToProfile, setPostToProfile] = usePersistentState<boolean>('rmp_post_to_profile', false);
  const [hasFlairErrors, setHasFlairErrors] = useState(false);
  const [customTitles, setCustomTitles] = usePersistentState<Record<string, string>>('rmp_custom_titles', {});
  const [contentOverrides, setContentOverrides] = usePersistentState<Record<string, PerSubredditOverride>>('rmp_content_overrides', {});
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Last post settings state
  const [lastPostSettings, setLastPostSettings] = useState<SavedPostSettings | null>(null);
  const [justAppliedLastPost, setJustAppliedLastPost] = useState(false);
  const hasMigratedSubredditKeysRef = useRef(false);

  // Load last post settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_POST_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SavedPostSettings;
        // Validate the parsed data has required fields
        if (parsed.subreddits && Array.isArray(parsed.subreddits) && parsed.savedAt) {
          setLastPostSettings({
            ...parsed,
            flairs: normalizeSubredditRecordKeys(parsed.flairs || {}),
            titleSuffixes: normalizeSubredditRecordKeys(parsed.titleSuffixes || {}),
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load last post settings:', error);
    }
  }, []);

  // One-time key migration for persisted subreddit-indexed maps.
  useEffect(() => {
    if (hasMigratedSubredditKeysRef.current) return;
    hasMigratedSubredditKeysRef.current = true;

    const migratedFlairs = normalizeSubredditRecordKeys(flairs);
    if (!areRecordsEqual(flairs, migratedFlairs)) {
      setFlairs(migratedFlairs);
    }

    const migratedTitleSuffixes = normalizeSubredditRecordKeys(titleSuffixes);
    if (!areRecordsEqual(titleSuffixes, migratedTitleSuffixes)) {
      setTitleSuffixes(migratedTitleSuffixes);
    }
  }, [flairs, titleSuffixes, setFlairs, setTitleSuffixes]);

  /**
   * Save current subreddit selection, flairs, and title suffixes as "last post settings"
   * Should be called after a successful post
   */
  const saveCurrentAsLastPost = useCallback(() => {
    // Only save if we have at least one subreddit selected
    if (selectedSubs.length === 0) return;

    const settings: SavedPostSettings = {
      subreddits: [...selectedSubs],
      flairs: { ...flairs },
      titleSuffixes: { ...titleSuffixes },
      prefixes: { ...prefixes },
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(LAST_POST_SETTINGS_KEY, JSON.stringify(settings));
      setLastPostSettings(settings);
    } catch (error) {
      console.warn('Failed to save last post settings:', error);
    }
  }, [selectedSubs, flairs, titleSuffixes, prefixes]);

  /**
   * Apply saved last post settings to current state
   */
  const applyLastPostSettings = useCallback(() => {
    if (!lastPostSettings) return;

    // Apply the saved settings
    setSelectedSubs(lastPostSettings.subreddits);
    setFlairs(normalizeSubredditRecordKeys(lastPostSettings.flairs));
    setTitleSuffixes(normalizeSubredditRecordKeys(lastPostSettings.titleSuffixes));
    setPrefixes(lastPostSettings.prefixes);

    // Show feedback
    setJustAppliedLastPost(true);
    setTimeout(() => {
      setJustAppliedLastPost(false);
    }, 2000);
  }, [lastPostSettings, setSelectedSubs, setFlairs, setTitleSuffixes, setPrefixes]);

  const handleValidationChange = useCallback((hasErrors: boolean) => {
    setHasFlairErrors(hasErrors);
  }, []);

  const handlePostAttempt = useCallback(() => {
    setShowValidationErrors(true);
  }, []);

  const handleUnselectSuccessItems = useCallback((subreddits: string[]) => {
    setSelectedSubs(prev => prev.filter(s => !subreddits.includes(s)));
    setFlairs(prev => {
      const next = { ...prev };
      subreddits.forEach((subreddit) => {
        delete next[normalizeSubredditKey(subreddit)];
      });
      return next;
    });
    setTitleSuffixes(prev => {
      const next = { ...prev };
      subreddits.forEach((subreddit) => {
        delete next[normalizeSubredditKey(subreddit)];
      });
      return next;
    });
    setCustomTitles(prev => {
      const next = { ...prev };
      subreddits.forEach((subreddit) => {
        delete next[subreddit];
      });
      return next;
    });
    setContentOverrides(prev => {
      const next = { ...prev };
      subreddits.forEach((subreddit) => {
        delete next[subreddit];
      });
      return next;
    });
    if (subreddits.some((subreddit) => subreddit.startsWith('u_'))) {
      setPostToProfile(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSubs([]);
  }, []);

  const clearAllState = useCallback(() => {
    setSelectedSubs([]);
    setCaption('');
    setBody('');
    setFlairs({});
    setTitleSuffixes({});
    setContentOverrides({});
    setMediaUrl('');
    setMediaType('image');
    setMediaFiles([]);
    setPrefixes({ f: false, c: false });
    setPostToProfile(false);
    setCustomTitles({});
    setHasFlairErrors(false);
    setShowValidationErrors(false);
  }, []);

  const items = useMemo(() => {
    const allItems: QueueItem[] = [];
    
    const destinations = [...selectedSubs];
    if (postToProfile && authMe?.name) {
      destinations.push(`u_${authMe.name}`);
    }
    
    if (mediaFiles.length > 0) {
      destinations.forEach((sr) => {
        let kind: 'image' | 'video' | 'gallery';
        if (mediaFiles.length > 1) {
          kind = 'gallery';
        } else {
          kind = mediaFiles[0].type.startsWith('video/') ? 'video' : 'image';
        }
        
        // Use per-subreddit overrides if available
        const override = contentOverrides[sr];
        const effectiveTitle = override?.title || customTitles[sr];
        const effectiveBody = override?.body ?? body;
        
        allItems.push({
          subreddit: sr,
          flairId: flairs[normalizeSubredditKey(sr)],
          titleSuffix: titleSuffixes[normalizeSubredditKey(sr)],
          customTitle: effectiveTitle,
          kind,
          files: mediaFiles,
          url: undefined,
          text: effectiveBody || undefined,
        });
      });
    } else if (mediaUrl) {
      destinations.forEach((sr) => {
        // Use per-subreddit overrides if available
        const override = contentOverrides[sr];
        const effectiveTitle = override?.title || customTitles[sr];
        const effectiveBody = override?.body ?? body;
        
        allItems.push({
          subreddit: sr,
          flairId: flairs[normalizeSubredditKey(sr)],
          titleSuffix: titleSuffixes[normalizeSubredditKey(sr)],
          customTitle: effectiveTitle,
          kind: 'link',
          url: mediaUrl,
          file: undefined,
          text: effectiveBody || undefined,
        });
      });
    } else {
      destinations.forEach((sr) => {
        // Use per-subreddit overrides if available
        const override = contentOverrides[sr];
        const effectiveTitle = override?.title || customTitles[sr];
        const effectiveBody = override?.body ?? body;
        
        allItems.push({
          subreddit: sr,
          flairId: flairs[normalizeSubredditKey(sr)],
          titleSuffix: titleSuffixes[normalizeSubredditKey(sr)],
          customTitle: effectiveTitle,
          kind: 'self',
          url: undefined,
          file: undefined,
          text: effectiveBody || caption,
        });
      });
    }
    
    return allItems;
  }, [selectedSubs, flairs, titleSuffixes, customTitles, contentOverrides, mediaUrl, mediaFiles, caption, body, postToProfile, authMe?.name]);

  return {
    selectedSubs,
    setSelectedSubs,
    caption,
    setCaption,
    body,
    setBody,
    prefixes,
    setPrefixes,
    mediaUrl,
    setMediaUrl,
    mediaFiles,
    setMediaFiles,
    mediaType,
    setMediaType,
    flairs,
    setFlairs,
    titleSuffixes,
    setTitleSuffixes,
    customTitles,
    setCustomTitles,
    contentOverrides,
    setContentOverrides,
    postToProfile,
    setPostToProfile,
    hasFlairErrors,
    setHasFlairErrors,
    showValidationErrors,
    setShowValidationErrors,
    items,
    handleValidationChange,
    handlePostAttempt,
    handleUnselectSuccessItems,
    clearSelection,
    clearAllState,
    // Last post settings feature
    hasLastPostSettings: lastPostSettings !== null && lastPostSettings.subreddits.length > 0,
    lastPostSettingsDate: lastPostSettings?.savedAt,
    justAppliedLastPost,
    saveCurrentAsLastPost,
    applyLastPostSettings,
  };
};
