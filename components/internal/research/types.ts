// Re-export types from the shared lib that UI components need
export type {
  ResearchCandidate,
  ResearchJobConfig,
  ResearchStep,
  ResearchStepStats,
} from '@/lib/internal/research/types';

// ---------------------------------------------------------------------------
// UI-specific types
// ---------------------------------------------------------------------------

export interface JobPayload {
  id: string;
  status: string;
  progressPercent: number;
  message: string | null;
  error: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  currentStep: import('@/lib/internal/research/types').ResearchStep | null;
  stepStats: import('@/lib/internal/research/types').ResearchStepStats | null;
  configJson: string;
}

export interface PostSummaryRow {
  subreddit: string;
  postCount: number;
}

export interface ProfileRow {
  username: string;
  hasProfileImage: boolean;
  profilePostsPublic: boolean;
  totalPostsScanned: number;
}

export interface DiscoveredSubredditRow {
  subreddit: string;
  userCount: number;
  postCount: number;
  isNsfw: boolean;
}

export type JobPhase = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export type StepCardStatus = 'ready' | 'running' | 'done' | 'failed';

export interface WorkspaceSubreddit {
  subreddit: string;
  addedAt: string;
  scanStatus: 'scanned' | 'pending';
  lastScannedAt: string | null;
  postCount: number;
}

export interface WorkspaceStats {
  totalSubreddits: number;
  pendingSubreddits: number;
  totalPosts: number;
  totalProfiles: number;
  totalCandidates: number;
  lastScanAt: string | null;
  activeJobId: string | null;
  activeJob: JobPayload | null;
}

/** @deprecated Use WorkspaceSubreddit instead */
export interface MasterSubreddit {
  subreddit: string;
  status: 'scanned' | 'pending';
  postsCollected: number;
}
