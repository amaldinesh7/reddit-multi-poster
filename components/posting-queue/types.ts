export interface QueueItemData {
  subreddit: string;
  flairId?: string;
  titleSuffix?: string;
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
