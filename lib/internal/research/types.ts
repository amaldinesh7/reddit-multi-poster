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

export type CollectBatchSize = 5 | 10 | 20 | 50;

export const COLLECT_BATCH_SIZES: CollectBatchSize[] = [5, 10, 20, 50];

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
  score: number | null;
  numComments: number | null;
  upvoteRatio: number | null;
  engagementSyncedAt: string | null;
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
  score?: number | null;
  numComments?: number | null;
  upvoteRatio?: number | null;
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
  outreachStatus?: OutreachStatus;
  lastSentAt?: string | null;
  lastReplyAt?: string | null;
  replyCount?: number;
  lastReplyExcerpt?: string;
}

export type OutreachMessageStatus = 'sent' | 'failed';

export type OutreachStatus = 'not_contacted' | 'sent' | 'failed' | 'replied';

export interface OutreachTemplate {
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface OutreachRecipient {
  username: string;
  suggestedChannel: string;
  overallScore: number;
}

export interface OutreachSendRequest {
  recipients: OutreachRecipient[];
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface OutreachSendResult {
  username: string;
  status: OutreachMessageStatus;
  error: string | null;
}

export interface OutreachSyncResult {
  fetched: number;
  matched: number;
  inserted: number;
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

export type AnalyticsRefreshMode = 'missing_only' | 'recent_only';

export interface AnalyticsSummaryQuery {
  lookbackDays: number;
  minPostAgeHours: number;
  timezone: string;
  minPostsPerUser: number;
}

export interface AnalyticsCoverageSummary {
  totalPosts: number;
  postsWithScore: number;
  postsWithComments: number;
  postsWithBoth: number;
  scoreCoverage: number;
  commentsCoverage: number;
  bothCoverage: number;
}

export interface AnalyticsHourBucket {
  hour: number;
  posts: number;
  volumeShare: number;
  avgScore: number | null;
  avgComments: number | null;
}

export interface AnalyticsDowBucket {
  dow: number;
  dowLabel: string;
  posts: number;
  volumeShare: number;
  avgScore: number | null;
  avgComments: number | null;
}

export interface AnalyticsHeatmapCell {
  dow: number;
  dowLabel: string;
  hour: number;
  posts: number;
  volumeShare: number;
  avgScore: number | null;
  avgComments: number | null;
  windowScore: number;
}

export interface AnalyticsFrequencyBucket {
  bucket: string;
  users: number;
  avgPostsPerActiveDay: number;
  avgPostsPerWeek: number;
  avgScore: number | null;
  avgComments: number | null;
}

export interface AnalyticsCorrelation {
  key: string;
  label: string;
  rho: number | null;
  n: number;
  interpretation: string;
}

export interface AnalyticsBestWindow {
  dow: number;
  dowLabel: string;
  hour: number;
  label: string;
  posts: number;
  volumeShare: number;
  avgScore: number | null;
  avgComments: number | null;
  windowScore: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface AnalyticsSummaryPayload {
  generatedAt: string;
  query: AnalyticsSummaryQuery;
  coverage: AnalyticsCoverageSummary;
  totalUsersConsidered: number;
  postingVolumeByHour: AnalyticsHourBucket[];
  postingVolumeByDow: AnalyticsDowBucket[];
  heatmap: AnalyticsHeatmapCell[];
  frequencyBins: AnalyticsFrequencyBucket[];
  correlations: AnalyticsCorrelation[];
  bestWindows: AnalyticsBestWindow[];
  caveats: string[];
}

export interface AnalyticsRefreshRequest {
  mode?: AnalyticsRefreshMode;
  maxPosts?: number;
  batchSize?: number;
}

export interface AnalyticsRefreshResponse {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
  remainingMissing: number;
}
