import { RedditRateLimiter } from './rateLimiter';
import type { ResearchJobConfig, UserSubmission } from './types';
import { normalizeTitle } from './patterns';
import { getSubredditPostCount, getGlobalSubredditPostCount, insertSubredditPost } from './db';

interface RedditListingChild<TData> {
  data: TData;
}

interface RedditListing<TData> {
  data: {
    children: Array<RedditListingChild<TData>>;
    after: string | null;
  };
}

interface RedditSubredditPostData {
  id: string;
  subreddit: string;
  author: string;
  title: string;
  url: string;
  created_utc: number;
  over_18: boolean;
  crosspost_parent?: string;
}

interface RedditUserPostData extends RedditSubredditPostData {
  selftext?: string;
}

interface UserAboutData {
  data: {
    icon_img?: string;
  };
}

const BANNED_AUTHORS = new Set(['[deleted]', 'AutoModerator']);

/** Extract HTTP status from an Axios-shaped error, or 0 if unknown. */
const extractHttpStatus = (error: unknown): number => {
  const axErr = error as { response?: { status?: number } };
  return axErr?.response?.status ?? 0;
};

export interface ProfileFetchResult {
  submissions: UserSubmission[];
  hasProfileImage: boolean;
  profilePostsPublic: boolean;
  /** Non-zero when the submissions fetch failed due to an HTTP error. */
  errorStatus: number;
  /** Human-readable error string (empty on success). */
  errorMessage: string;
}

const parseUserPost = (data: RedditUserPostData): UserSubmission => ({
  id: data.id,
  subreddit: data.subreddit,
  title: data.title ?? '',
  selftext: data.selftext ?? '',
  url: data.url ?? '',
  createdUtc: data.created_utc ?? 0,
  over18: Boolean(data.over_18),
  crosspostParent: data.crosspost_parent ?? null,
});

export const collectSubredditPosts = async (
  jobId: string,
  limiter: RedditRateLimiter,
  config: ResearchJobConfig,
  onProgress: (value: number, message: string) => void
): Promise<string[]> => {
  const allUsers = new Set<string>();
  const subredditCount = config.subreddits.length;

  for (let i = 0; i < config.subreddits.length; i += 1) {
    const subreddit = config.subreddits[i];
    const cachedCount = getSubredditPostCount(jobId, subreddit);
    let fetched = cachedCount;
    let after: string | null = null;

    if (cachedCount >= config.postsPerSubreddit) {
      onProgress(
        Math.round(((i + 1) / subredditCount) * 100),
        `Reused cached posts for r/${subreddit} (${cachedCount})`
      );
      continue;
    }

    // Global safety net: if posts exist across other jobs but weren't copied
    // into this job (e.g. new job, partial copy), skip the API call.
    const globalCount = getGlobalSubredditPostCount(subreddit);
    if (globalCount >= config.postsPerSubreddit) {
      onProgress(
        Math.round(((i + 1) / subredditCount) * 100),
        `Skipped r/${subreddit} — ${globalCount} posts already cached globally (job has ${cachedCount})`
      );
      continue;
    }

    try {
      while (fetched < config.postsPerSubreddit) {
        const batch = Math.min(100, config.postsPerSubreddit - fetched);
        const listing: RedditListing<RedditSubredditPostData> = await limiter.request({
          method: 'GET',
          url: `/r/${subreddit}/new`,
          params: { limit: batch, after, raw_json: 1 },
        });

        const posts = listing.data.children;
        if (!posts.length) break;

        posts.forEach((item: RedditListingChild<RedditSubredditPostData>) => {
          const post = item.data;
          if (BANNED_AUTHORS.has(post.author)) return;
          if (!config.includeNsfw && post.over_18) return;
          allUsers.add(post.author);
          insertSubredditPost({
            jobId,
            subreddit: post.subreddit,
            postId: post.id,
            author: post.author,
            title: post.title ?? '',
            normalizedTitle: normalizeTitle(post.title ?? ''),
            url: post.url ?? '',
            createdUtc: post.created_utc ?? 0,
            isNsfw: post.over_18 ? 1 : 0,
            crosspostParent: post.crosspost_parent ?? null,
          });
        });

        fetched += posts.length;
        after = listing.data.after;
        if (!after) break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      onProgress(
        Math.round(((i + 1) / subredditCount) * 100),
        `Skipped r/${subreddit}: ${message}`
      );
      continue;
    }

    onProgress(
      Math.round(((i + 1) / subredditCount) * 100),
      cachedCount > 0
        ? `Updated r/${subreddit}: ${fetched} posts (cached ${cachedCount})`
        : `Collected ${fetched} posts from r/${subreddit}`
    );
  }

  return Array.from(allUsers);
};

export const collectUserPosts = async (
  limiter: RedditRateLimiter,
  username: string,
  config: ResearchJobConfig
): Promise<ProfileFetchResult> => {
  let hasProfileImage = false;
  let profilePostsPublic = false;
  let errorStatus = 0;
  let errorMessage = '';

  try {
    const about = await limiter.request<UserAboutData>({
      method: 'GET',
      url: `/user/${username}/about`,
      params: { raw_json: 1 },
    });
    hasProfileImage = Boolean(about.data.icon_img);
  } catch (error: unknown) {
    const status = extractHttpStatus(error);
    const msg = error instanceof Error ? error.message : 'unknown';
    console.warn(`[research] /user/${username}/about failed (HTTP ${status}): ${msg}`);
    hasProfileImage = false;
  }

  const submissions: UserSubmission[] = [];
  let after: string | null = null;
  while (submissions.length < config.userPostsLimit) {
    const batch = Math.min(100, config.userPostsLimit - submissions.length);
    try {
      const listing: RedditListing<RedditUserPostData> = await limiter.request({
        method: 'GET',
        url: `/user/${username}/submitted`,
        params: { limit: batch, after, sort: 'new', raw_json: 1 },
      });
      const posts = listing.data.children.map((item: RedditListingChild<RedditUserPostData>) =>
        parseUserPost(item.data)
      );
      submissions.push(...posts);
      after = listing.data.after;
      profilePostsPublic = true;
      if (!after || posts.length === 0) break;
    } catch (error: unknown) {
      errorStatus = extractHttpStatus(error);
      errorMessage = error instanceof Error ? error.message : 'unknown error';
      console.warn(
        `[research] /user/${username}/submitted failed (HTTP ${errorStatus}): ${errorMessage}`
      );
      profilePostsPublic = false;
      break;
    }
  }

  return { submissions, hasProfileImage, profilePostsPublic, errorStatus, errorMessage };
};
