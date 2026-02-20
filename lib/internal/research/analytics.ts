import { redditClient } from '@/utils/reddit';
import { RedditRateLimiter } from './rateLimiter';
import {
  countPostsMissingEngagement,
  listAnalyticsPosts,
  listPostIdsForEngagementRefresh,
  updatePostEngagementByPostId,
} from './db';
import type {
  AnalyticsBestWindow,
  AnalyticsCorrelation,
  AnalyticsFrequencyBucket,
  AnalyticsRefreshMode,
  AnalyticsRefreshResponse,
  AnalyticsSummaryPayload,
  AnalyticsSummaryQuery,
} from './types';

interface RedditListingChild<TData> {
  data: TData;
}

interface RedditListing<TData> {
  data: {
    children: Array<RedditListingChild<TData>>;
    after: string | null;
  };
}

interface RedditInfoPostData {
  id: string;
  score?: number;
  num_comments?: number;
  upvote_ratio?: number;
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface AnalyticsInputPost {
  postId: string;
  author: string;
  createdUtc: number;
  score: number | null;
  numComments: number | null;
  upvoteRatio: number | null;
}

const round = (value: number, digits = 4): number =>
  Number(value.toFixed(digits));

const getWeekday = (shortWeekday: string): number => {
  const idx = DOW_LABELS.findIndex((label) => label === shortWeekday);
  return idx >= 0 ? idx : 0;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  if (items.length === 0) return [];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const percentile = (value: number, values: number[]): number => {
  if (values.length === 0) return 0;
  if (values.length === 1) return 1;
  const less = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  return (less + (equal - 1) / 2) / (values.length - 1);
};

const interpretCorrelation = (rho: number | null, n: number): string => {
  if (rho === null || n < 3) return 'insufficient data';
  const abs = Math.abs(rho);
  const strength = abs < 0.1
    ? 'negligible'
    : abs < 0.3
      ? 'weak'
      : abs < 0.5
        ? 'moderate'
        : 'strong';
  const direction = rho >= 0 ? 'positive' : 'negative';
  return `${strength} ${direction}`;
};

const rankWithTies = (values: number[]): number[] => {
  const pairs = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < pairs.length) {
    let j = i + 1;
    while (j < pairs.length && pairs[j].value === pairs[i].value) j += 1;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) {
      ranks[pairs[k].index] = avgRank;
    }
    i = j;
  }
  return ranks;
};

export const computeSpearmanRho = (
  xValues: number[],
  yValues: number[]
): { rho: number | null; n: number } => {
  if (xValues.length !== yValues.length) {
    throw new Error('xValues and yValues must have equal length');
  }
  const n = xValues.length;
  if (n < 2) return { rho: null, n };

  const xRanks = rankWithTies(xValues);
  const yRanks = rankWithTies(yValues);

  const mean = (items: number[]): number =>
    items.reduce((sum, value) => sum + value, 0) / items.length;

  const xMean = mean(xRanks);
  const yMean = mean(yRanks);

  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;
  for (let i = 0; i < n; i += 1) {
    const xd = xRanks[i] - xMean;
    const yd = yRanks[i] - yMean;
    numerator += xd * yd;
    xVariance += xd * xd;
    yVariance += yd * yd;
  }

  const denom = Math.sqrt(xVariance * yVariance);
  if (denom === 0) return { rho: null, n };
  return { rho: round(numerator / denom, 4), n };
};

const getCorrelation = (
  key: string,
  label: string,
  xValues: number[],
  yValues: number[]
): AnalyticsCorrelation => {
  const { rho, n } = computeSpearmanRho(xValues, yValues);
  return {
    key,
    label,
    rho,
    n,
    interpretation: interpretCorrelation(rho, n),
  };
};

const toWindowLabel = (dow: number, hour: number): string => {
  const nextHour = (hour + 1) % 24;
  return `${DOW_LABELS[dow]} ${String(hour).padStart(2, '0')}:00-${String(nextHour).padStart(2, '0')}:00`;
};

export const buildAnalyticsSummaryFromPosts = (
  posts: AnalyticsInputPost[],
  query: AnalyticsSummaryQuery
): AnalyticsSummaryPayload => {
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: query.timezone,
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const hourAgg = Array.from({ length: 24 }, () => ({
    posts: 0,
    scoreSum: 0,
    scoreCount: 0,
    commentsSum: 0,
    commentsCount: 0,
  }));
  const dowAgg = Array.from({ length: 7 }, () => ({
    posts: 0,
    scoreSum: 0,
    scoreCount: 0,
    commentsSum: 0,
    commentsCount: 0,
  }));
  const heatMap = new Map<string, {
    dow: number;
    hour: number;
    posts: number;
    scoreSum: number;
    scoreCount: number;
    commentsSum: number;
    commentsCount: number;
  }>();
  for (let dow = 0; dow < 7; dow += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      heatMap.set(`${dow}-${hour}`, {
        dow,
        hour,
        posts: 0,
        scoreSum: 0,
        scoreCount: 0,
        commentsSum: 0,
        commentsCount: 0,
      });
    }
  }

  const userAgg = new Map<string, {
    posts: number;
    dayKeys: Set<string>;
    scoreSum: number;
    scoreCount: number;
    commentsSum: number;
    commentsCount: number;
  }>();

  let postsWithScore = 0;
  let postsWithComments = 0;
  let postsWithBoth = 0;

  for (const post of posts) {
    const parts = timeFormatter.formatToParts(new Date(post.createdUtc * 1000));
    const hourPart = parts.find((part) => part.type === 'hour')?.value ?? '00';
    const weekdayPart = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = parts.find((part) => part.type === 'month')?.value ?? '01';
    const day = parts.find((part) => part.type === 'day')?.value ?? '01';
    const dayKey = `${year}-${month}-${day}`;

    const parsedHour = Number(hourPart);
    const hour = Number.isFinite(parsedHour)
      ? (parsedHour >= 24 ? parsedHour % 24 : parsedHour)
      : 0;
    const dow = getWeekday(weekdayPart);
    const cellKey = `${dow}-${hour}`;

    const score = typeof post.score === 'number' ? post.score : null;
    const comments = typeof post.numComments === 'number' ? post.numComments : null;

    hourAgg[hour].posts += 1;
    dowAgg[dow].posts += 1;
    const cell = heatMap.get(cellKey);
    if (cell) cell.posts += 1;

    if (score !== null) {
      hourAgg[hour].scoreSum += score;
      hourAgg[hour].scoreCount += 1;
      dowAgg[dow].scoreSum += score;
      dowAgg[dow].scoreCount += 1;
      if (cell) {
        cell.scoreSum += score;
        cell.scoreCount += 1;
      }
      postsWithScore += 1;
    }

    if (comments !== null) {
      hourAgg[hour].commentsSum += comments;
      hourAgg[hour].commentsCount += 1;
      dowAgg[dow].commentsSum += comments;
      dowAgg[dow].commentsCount += 1;
      if (cell) {
        cell.commentsSum += comments;
        cell.commentsCount += 1;
      }
      postsWithComments += 1;
    }

    if (score !== null && comments !== null) postsWithBoth += 1;

    const user = userAgg.get(post.author) ?? {
      posts: 0,
      dayKeys: new Set<string>(),
      scoreSum: 0,
      scoreCount: 0,
      commentsSum: 0,
      commentsCount: 0,
    };
    user.posts += 1;
    user.dayKeys.add(dayKey);
    if (score !== null) {
      user.scoreSum += score;
      user.scoreCount += 1;
    }
    if (comments !== null) {
      user.commentsSum += comments;
      user.commentsCount += 1;
    }
    userAgg.set(post.author, user);
  }

  const totalPosts = posts.length;
  const coverage = {
    totalPosts,
    postsWithScore,
    postsWithComments,
    postsWithBoth,
    scoreCoverage: totalPosts > 0 ? round(postsWithScore / totalPosts, 4) : 0,
    commentsCoverage: totalPosts > 0 ? round(postsWithComments / totalPosts, 4) : 0,
    bothCoverage: totalPosts > 0 ? round(postsWithBoth / totalPosts, 4) : 0,
  };

  const postingVolumeByHour = hourAgg.map((agg, hour) => ({
    hour,
    posts: agg.posts,
    volumeShare: totalPosts > 0 ? round(agg.posts / totalPosts, 4) : 0,
    avgScore: agg.scoreCount > 0 ? round(agg.scoreSum / agg.scoreCount, 3) : null,
    avgComments: agg.commentsCount > 0 ? round(agg.commentsSum / agg.commentsCount, 3) : null,
  }));

  const postingVolumeByDow = dowAgg.map((agg, dow) => ({
    dow,
    dowLabel: DOW_LABELS[dow],
    posts: agg.posts,
    volumeShare: totalPosts > 0 ? round(agg.posts / totalPosts, 4) : 0,
    avgScore: agg.scoreCount > 0 ? round(agg.scoreSum / agg.scoreCount, 3) : null,
    avgComments: agg.commentsCount > 0 ? round(agg.commentsSum / agg.commentsCount, 3) : null,
  }));

  const heatmap = Array.from(heatMap.values()).map((cell) => ({
    dow: cell.dow,
    dowLabel: DOW_LABELS[cell.dow],
    hour: cell.hour,
    posts: cell.posts,
    volumeShare: totalPosts > 0 ? round(cell.posts / totalPosts, 4) : 0,
    avgScore: cell.scoreCount > 0 ? round(cell.scoreSum / cell.scoreCount, 3) : null,
    avgComments: cell.commentsCount > 0 ? round(cell.commentsSum / cell.commentsCount, 3) : null,
    windowScore: 0,
  }));

  const userRows = Array.from(userAgg.entries())
    .map(([username, agg]) => {
      const activeDays = Math.max(1, agg.dayKeys.size);
      const postsPerActiveDay = agg.posts / activeDays;
      return {
        username,
        posts: agg.posts,
        postsPerActiveDay,
        postsPerWeek: postsPerActiveDay * 7,
        avgScore: agg.scoreCount > 0 ? agg.scoreSum / agg.scoreCount : null,
        avgComments: agg.commentsCount > 0 ? agg.commentsSum / agg.commentsCount : null,
      };
    })
    .filter((row) => row.posts >= query.minPostsPerUser);

  const bins = [
    { key: 'casual (<1/day)', min: 0, max: 1 },
    { key: 'steady (1-3/day)', min: 1, max: 3 },
    { key: 'aggressive (3-10/day)', min: 3, max: 10 },
    { key: 'very aggressive (10+/day)', min: 10, max: Number.POSITIVE_INFINITY },
  ];
  const binAgg = new Map<string, {
    users: number;
    postsPerDaySum: number;
    postsPerWeekSum: number;
    scoreSum: number;
    scoreCount: number;
    commentsSum: number;
    commentsCount: number;
  }>();
  for (const bin of bins) {
    binAgg.set(bin.key, {
      users: 0,
      postsPerDaySum: 0,
      postsPerWeekSum: 0,
      scoreSum: 0,
      scoreCount: 0,
      commentsSum: 0,
      commentsCount: 0,
    });
  }

  for (const row of userRows) {
    const bin = bins.find((item) => row.postsPerActiveDay >= item.min && row.postsPerActiveDay < item.max);
    if (!bin) continue;
    const agg = binAgg.get(bin.key);
    if (!agg) continue;
    agg.users += 1;
    agg.postsPerDaySum += row.postsPerActiveDay;
    agg.postsPerWeekSum += row.postsPerWeek;
    if (row.avgScore !== null) {
      agg.scoreSum += row.avgScore;
      agg.scoreCount += 1;
    }
    if (row.avgComments !== null) {
      agg.commentsSum += row.avgComments;
      agg.commentsCount += 1;
    }
  }

  const frequencyBins: AnalyticsFrequencyBucket[] = bins.map((bin) => {
    const agg = binAgg.get(bin.key)!;
    return {
      bucket: bin.key,
      users: agg.users,
      avgPostsPerActiveDay: agg.users > 0 ? round(agg.postsPerDaySum / agg.users, 3) : 0,
      avgPostsPerWeek: agg.users > 0 ? round(agg.postsPerWeekSum / agg.users, 3) : 0,
      avgScore: agg.scoreCount > 0 ? round(agg.scoreSum / agg.scoreCount, 3) : null,
      avgComments: agg.commentsCount > 0 ? round(agg.commentsSum / agg.commentsCount, 3) : null,
    };
  });

  const freqVsScoreRows = userRows.filter((row) => row.avgScore !== null);
  const freqVsCommentsRows = userRows.filter((row) => row.avgComments !== null);
  const hourlyScoreRows = postingVolumeByHour.filter((row) => row.avgScore !== null);
  const hourlyCommentsRows = postingVolumeByHour.filter((row) => row.avgComments !== null);

  const correlations: AnalyticsCorrelation[] = [
    getCorrelation(
      'frequency_vs_score',
      'Posting frequency vs avg upvotes',
      freqVsScoreRows.map((row) => row.postsPerActiveDay),
      freqVsScoreRows.map((row) => row.avgScore ?? 0)
    ),
    getCorrelation(
      'frequency_vs_comments',
      'Posting frequency vs avg comments',
      freqVsCommentsRows.map((row) => row.postsPerActiveDay),
      freqVsCommentsRows.map((row) => row.avgComments ?? 0)
    ),
    getCorrelation(
      'hourly_volume_vs_score',
      'Hourly post volume vs avg upvotes',
      hourlyScoreRows.map((row) => row.posts),
      hourlyScoreRows.map((row) => row.avgScore ?? 0)
    ),
    getCorrelation(
      'hourly_volume_vs_comments',
      'Hourly post volume vs avg comments',
      hourlyCommentsRows.map((row) => row.posts),
      hourlyCommentsRows.map((row) => row.avgComments ?? 0)
    ),
  ];

  const scoreValues = heatmap
    .map((cell) => cell.avgScore)
    .filter((value): value is number => typeof value === 'number');
  const commentsValues = heatmap
    .map((cell) => cell.avgComments)
    .filter((value): value is number => typeof value === 'number');

  const scoredHeatmap = heatmap.map((cell) => {
    const scorePct = cell.avgScore === null ? 0 : percentile(cell.avgScore, scoreValues);
    const commentsPct = cell.avgComments === null ? 0 : percentile(cell.avgComments, commentsValues);
    const windowScore = round((0.5 * cell.volumeShare) + (0.3 * scorePct) + (0.2 * commentsPct), 5);
    return {
      ...cell,
      windowScore,
    };
  });

  const bestWindows: AnalyticsBestWindow[] = scoredHeatmap
    .filter((cell) => cell.posts > 0)
    .sort((a, b) => b.windowScore - a.windowScore || b.posts - a.posts)
    .slice(0, 5)
    .map((cell) => ({
      dow: cell.dow,
      dowLabel: cell.dowLabel,
      hour: cell.hour,
      label: toWindowLabel(cell.dow, cell.hour),
      posts: cell.posts,
      volumeShare: cell.volumeShare,
      avgScore: cell.avgScore,
      avgComments: cell.avgComments,
      windowScore: cell.windowScore,
      confidence: coverage.bothCoverage < 0.3 || cell.posts < 10
        ? 'low'
        : cell.posts < 25
          ? 'medium'
          : 'high',
    }));

  const caveats: string[] = [];
  if (totalPosts === 0) {
    caveats.push('No posts matched current filters.');
  }
  if (coverage.bothCoverage < 0.3) {
    caveats.push('Low engagement coverage (<30%). Run refresh to improve confidence.');
  }
  if (totalPosts > 0 && totalPosts < 200) {
    caveats.push('Small post sample size. Interpret trends cautiously.');
  }
  if (userRows.length < 30) {
    caveats.push('Few users qualified for frequency correlation (minPostsPerUser threshold).');
  }

  return {
    generatedAt: new Date().toISOString(),
    query,
    coverage,
    totalUsersConsidered: userRows.length,
    postingVolumeByHour,
    postingVolumeByDow,
    heatmap: scoredHeatmap,
    frequencyBins,
    correlations,
    bestWindows,
    caveats,
  };
};

export const getWorkspaceAnalyticsSummary = (
  query: AnalyticsSummaryQuery
): AnalyticsSummaryPayload => {
  const posts = listAnalyticsPosts({
    lookbackDays: query.lookbackDays,
    minPostAgeHours: query.minPostAgeHours,
  });
  return buildAnalyticsSummaryFromPosts(posts, query);
};

export const refreshWorkspacePostEngagement = async (args: {
  token: string;
  mode: AnalyticsRefreshMode;
  maxPosts: number;
  batchSize: number;
}): Promise<AnalyticsRefreshResponse> => {
  const targets = listPostIdsForEngagementRefresh(args.mode, args.maxPosts);
  if (targets.length === 0) {
    return {
      scanned: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      remainingMissing: 0,
    };
  }

  const limiter = new RedditRateLimiter(redditClient(args.token));
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  const batches = chunk(targets, Math.max(1, Math.min(args.batchSize, 100)));
  for (const batch of batches) {
    try {
      const listing: RedditListing<RedditInfoPostData> = await limiter.request({
        method: 'GET',
        url: '/api/info',
        params: {
          id: batch.map((item) => `t3_${item.postId}`).join(','),
          raw_json: 1,
        },
      });

      const byId = new Map<string, RedditInfoPostData>();
      for (const item of listing.data.children) {
        if (!item.data?.id) continue;
        byId.set(item.data.id, item.data);
      }

      for (const target of batch) {
        scanned += 1;
        const data = byId.get(target.postId);
        if (!data) {
          skipped += 1;
          continue;
        }

        const changes = updatePostEngagementByPostId({
          postId: target.postId,
          score: typeof data.score === 'number' ? data.score : null,
          numComments: typeof data.num_comments === 'number' ? data.num_comments : null,
          upvoteRatio: typeof data.upvote_ratio === 'number' ? data.upvote_ratio : null,
        });

        if (changes > 0) updated += 1;
        else skipped += 1;
      }
    } catch {
      failed += batch.length;
      scanned += batch.length;
    }
    await sleep(200);
  }

  return {
    scanned,
    updated,
    skipped,
    failed,
    remainingMissing: countPostsMissingEngagement(),
  };
};
