import type { PatternEvidence, ResearchCandidate, UserSubmission } from './types';

export const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
};

const buildFingerprint = (post: UserSubmission): string => {
  if (post.crosspostParent) return `cross:${post.crosspostParent}`;
  if (post.url) return `url:${normalizeUrl(post.url)}`;
  const body = post.selftext.slice(0, 120).toLowerCase();
  return `text:${normalizeTitle(post.title)}:${body}`;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const pickSuggestedChannel = (subreddits: string[]): string => {
  if (!subreddits.length) return 'reddit_dm';
  return `r/${subreddits[0]}`;
};

export const buildCandidateFromPosts = (
  username: string,
  submissions: UserSubmission[],
  nowUtc: number,
  lookbackHours: number,
  lookbackDays: number,
  hasProfileImage: boolean,
  profilePostsPublic: boolean
): ResearchCandidate | null => {
  if (!submissions.length) return null;
  const lookback7dStart = nowUtc - lookbackDays * 24 * 3600;
  const lookback24hStart = nowUtc - lookbackHours * 3600;
  const posts7d = submissions.filter((post) => post.createdUtc >= lookback7dStart);
  if (!posts7d.length) return null;

  const subreddits7d = new Set(posts7d.map((post) => post.subreddit));
  const posts24h = posts7d.filter((post) => post.createdUtc >= lookback24hStart);
  const subreddits24h = new Set(posts24h.map((post) => post.subreddit));

  const groupedByFingerprint = new Map<string, UserSubmission[]>();
  posts24h.forEach((post) => {
    const key = buildFingerprint(post);
    const list = groupedByFingerprint.get(key) ?? [];
    list.push(post);
    groupedByFingerprint.set(key, list);
  });

  let duplicateClusters = 0;
  let maxClusterSize = 0;
  let totalDuplicatePosts = 0;
  const repeatedTitles = new Set<string>();
  groupedByFingerprint.forEach((cluster) => {
    const clusterSubreddits = new Set(cluster.map((item) => item.subreddit));
    if (clusterSubreddits.size >= 2) {
      duplicateClusters += 1;
      maxClusterSize = Math.max(maxClusterSize, cluster.length);
      totalDuplicatePosts += cluster.length;
      repeatedTitles.add(normalizeTitle(cluster[0]?.title ?? ''));
    }
  });
  const avgClusterSize = duplicateClusters > 0
    ? Number((totalDuplicatePosts / duplicateClusters).toFixed(1))
    : 0;

  const postsPerDay = posts7d.length / Math.max(1, lookbackDays);
  const frequencyScore = clamp(postsPerDay / 8, 0, 1);
  const crossSubredditScore = clamp(subreddits24h.size / 5, 0, 1);
  const duplicateScore = clamp((duplicateClusters * 0.6) + (maxClusterSize / 5), 0, 1);
  const overallScore = Number(
    (0.35 * frequencyScore + 0.35 * crossSubredditScore + 0.3 * duplicateScore).toFixed(4)
  );

  const meetsThreshold = posts7d.length >= 2 || subreddits24h.size >= 1;
  if (!meetsThreshold) return null;

  const evidence: PatternEvidence = {
    subreddits24h: Array.from(subreddits24h),
    sampleLinks: posts24h.slice(0, 5).map((post) => `https://reddit.com/comments/${post.id}`),
    repeatedTitles: Array.from(repeatedTitles).slice(0, 5),
    duplicateClusters,
    maxClusterSize,
    hasNsfw: posts24h.some((post) => post.over18),
  };

  const suggestedChannel = pickSuggestedChannel(Array.from(subreddits24h));
  const noteText = `Active in ${subreddits24h.size} subreddit(s) in last ${lookbackHours}h; ${duplicateClusters} duplicate cluster(s).`;

  return {
    username,
    frequencyScore: Number(frequencyScore.toFixed(4)),
    duplicateScore: Number(duplicateScore.toFixed(4)),
    crossSubredditScore: Number(crossSubredditScore.toFixed(4)),
    overallScore,
    clusterCount: duplicateClusters,
    maxClusterSize,
    totalDuplicatePosts,
    avgClusterSize,
    subredditsCount: subreddits7d.size,
    hasProfileImage,
    profilePostsPublic,
    totalPostsScanned: submissions.length,
    evidence,
    suggestedChannel,
    noteText,
  };
};
