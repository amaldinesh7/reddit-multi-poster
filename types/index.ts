export interface SelectedSubreddit {
  name: string;
  flairId?: string;
}

export interface MediaItem {
  type: 'file' | 'url';
  file?: File;
  url?: string;
}

export interface QueueItem {
  subreddit: string;
  title?: string;
  flairId?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  text?: string;
  url?: string;
  file?: File;
  files?: File[]; // Support for multiple files
  status?: 'queued' | 'posting' | 'success' | 'error' | 'retrying' | 'cancelled';
  error?: string;
  attempt?: number;
} 