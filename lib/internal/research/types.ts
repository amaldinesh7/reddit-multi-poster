export type ResearchJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ResearchStep =
  | 'collect_posts'
  | 'profile_users'
  | 'score_rank'
  | 'done';

export interface ResearchStepStats {
  postsCollected: number;
  subredditsScanned: number;
  usersTotal: number;
  usersProfiled: number;
  usersSkippedCached: number;
  candidatesFound: number;
}

export interface ResearchJobConfig {
  subreddits: string[];
  postsPerSubreddit: number;
  maxUsersToAnalyze: number;
  userPostsLimit: number;
  lookbackHours: number;
  lookbackDays: number;
  includeNsfw: boolean;
  concurrency: number;
}

export interface ResearchJobRow {
  id: string;
  status: ResearchJobStatus;
  configJson: string;
  progressPercent: number;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  cancelRequested: number;
  updatedAt: string | null;
  currentStep: ResearchStep | null;
  stepStats: ResearchStepStats | null;
}

export interface ResearchSubredditPost {
  jobId: string;
  subreddit: string;
  postId: string;
  author: string;
  title: string;
  normalizedTitle: string;
  url: string;
  createdUtc: number;
  isNsfw: number;
  crosspostParent: string | null;
}

export interface UserSubmission {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
  createdUtc: number;
  over18: boolean;
  crosspostParent: string | null;
}

export interface PatternEvidence {
  subreddits24h: string[];
  sampleLinks: string[];
  repeatedTitles: string[];
  duplicateClusters: number;
  maxClusterSize: number;
  hasNsfw: boolean;
}

export interface ResearchCandidate {
  username: string;
  frequencyScore: number;
  duplicateScore: number;
  crossSubredditScore: number;
  overallScore: number;
  clusterCount: number;
  maxClusterSize: number;
  totalDuplicatePosts: number;
  avgClusterSize: number;
  subredditsCount: number;
  hasProfileImage: boolean;
  profilePostsPublic: boolean;
  totalPostsScanned: number;
  evidence: PatternEvidence;
  suggestedChannel: string;
  noteText: string;
}

export interface StartJobRequest {
  subreddits: string;
  includeNsfw?: boolean;
  postsPerSubreddit?: number;
  maxUsersToAnalyze?: number;
  userPostsLimit?: number;
  lookbackHours?: number;
  lookbackDays?: number;
  concurrency?: number;
}

export interface DiscoveredSubreddit {
  subreddit: string;
  userCount: number;
  postCount: number;
  isNsfw: boolean;
}

export interface ResearchResultsQuery {
  page: number;
  pageSize: number;
  minScore: number;
  minSubreddits: number;
  nsfwOnly: boolean;
  duplicateOnly: boolean;
}
