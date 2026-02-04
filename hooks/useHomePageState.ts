import { useState, useMemo, useCallback } from 'react';
import { QueueItem } from '@/types';
import { usePersistentState } from './usePersistentState';

interface MeData {
  name: string;
  icon_img?: string;
  id?: string;
}

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
  mediaMode: 'file' | 'url';
  setMediaMode: (value: 'file' | 'url' | ((val: 'file' | 'url') => 'file' | 'url')) => void;
  flairs: Record<string, string | undefined>;
  setFlairs: (value: Record<string, string | undefined> | ((val: Record<string, string | undefined>) => Record<string, string | undefined>)) => void;
  titleSuffixes: Record<string, string | undefined>;
  setTitleSuffixes: (value: Record<string, string | undefined> | ((val: Record<string, string | undefined>) => Record<string, string | undefined>)) => void;
  customTitles: Record<string, string>;
  setCustomTitles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
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
}

export const useHomePageState = ({ authMe }: UseHomePageStateProps): UseHomePageStateReturn => {
  const [selectedSubs, setSelectedSubs] = usePersistentState<string[]>('rmp_selected_subs', []);
  const [caption, setCaption] = usePersistentState<string>('rmp_caption', '');
  const [body, setBody] = usePersistentState<string>('rmp_body', '');
  const [prefixes, setPrefixes] = useState({ f: false, c: false });
  const [mediaUrl, setMediaUrl] = usePersistentState<string>('rmp_media_url', '');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaMode, setMediaMode] = usePersistentState<'file' | 'url'>('rmp_media_mode', 'file');
  const [flairs, setFlairs] = usePersistentState<Record<string, string | undefined>>('rmp_flairs', {});
  const [titleSuffixes, setTitleSuffixes] = usePersistentState<Record<string, string | undefined>>('rmp_title_suffixes', {});
  const [postToProfile, setPostToProfile] = useState(false);
  const [hasFlairErrors, setHasFlairErrors] = useState(false);
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const handleValidationChange = useCallback((hasErrors: boolean) => {
    setHasFlairErrors(hasErrors);
  }, []);

  const handlePostAttempt = useCallback(() => {
    setShowValidationErrors(true);
  }, []);

  const handleUnselectSuccessItems = useCallback((subreddits: string[]) => {
    setSelectedSubs(prev => prev.filter(s => !subreddits.includes(s)));
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
    setMediaUrl('');
    setMediaMode('file');
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
        
        allItems.push({
          subreddit: sr,
          flairId: flairs[sr],
          titleSuffix: titleSuffixes[sr],
          customTitle: customTitles[sr],
          kind,
          files: mediaFiles,
          url: undefined,
          text: body || undefined,
        });
      });
    } else if (mediaUrl) {
      destinations.forEach((sr) => {
        allItems.push({
          subreddit: sr,
          flairId: flairs[sr],
          titleSuffix: titleSuffixes[sr],
          customTitle: customTitles[sr],
          kind: 'link',
          url: mediaUrl,
          file: undefined,
          text: body || undefined,
        });
      });
    } else {
      destinations.forEach((sr) => {
        allItems.push({
          subreddit: sr,
          flairId: flairs[sr],
          titleSuffix: titleSuffixes[sr],
          customTitle: customTitles[sr],
          kind: 'self',
          url: undefined,
          file: undefined,
          text: body || caption,
        });
      });
    }
    
    return allItems;
  }, [selectedSubs, flairs, titleSuffixes, customTitles, mediaUrl, mediaFiles, caption, body, postToProfile, authMe?.name]);

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
    mediaMode,
    setMediaMode,
    flairs,
    setFlairs,
    titleSuffixes,
    setTitleSuffixes,
    customTitles,
    setCustomTitles,
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
  };
};
