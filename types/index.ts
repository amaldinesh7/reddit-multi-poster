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
  kind: 'self' | 'link' | 'image' | 'video';
  text?: string;
  url?: string;
  file?: File;
  status?: 'queued' | 'posting' | 'success' | 'error' | 'retrying';
  error?: string;
  attempt?: number;
} 