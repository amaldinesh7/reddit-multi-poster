import { useState, useMemo, useCallback } from 'react';
import { QueueItem } from '@/types';

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
  setSelectedSubs: React.Dispatch<React.SetStateAction<string[]>>;
  caption: string;
  setCaption: React.Dispatch<React.SetStateAction<string>>;
  body: string;
  setBody: React.Dispatch<React.SetStateAction<string>>;
  prefixes: { f: boolean; c: boolean };
  setPrefixes: React.Dispatch<React.SetStateAction<{ f: boolean; c: boolean }>>;
  mediaUrl: string;
  setMediaUrl: React.Dispatch<React.SetStateAction<string>>;
  mediaFiles: File[];
  setMediaFiles: React.Dispatch<React.SetStateAction<File[]>>;
  mediaMode: 'file' | 'url';
  setMediaMode: React.Dispatch<React.SetStateAction<'file' | 'url'>>;
  flairs: Record<string, string | undefined>;
  setFlairs: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>;
  titleSuffixes: Record<string, string | undefined>;
  setTitleSuffixes: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>;
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
}

export const useHomePageState = ({ authMe }: UseHomePageStateProps): UseHomePageStateReturn => {
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [body, setBody] = useState('');
  const [prefixes, setPrefixes] = useState({ f: false, c: false });
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaMode, setMediaMode] = useState<'file' | 'url'>('file');
  const [flairs, setFlairs] = useState<Record<string, string | undefined>>({});
  const [titleSuffixes, setTitleSuffixes] = useState<Record<string, string | undefined>>({});
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
  };
};
