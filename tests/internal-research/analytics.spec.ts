import { expect, test } from '@playwright/test';
import {
  buildAnalyticsSummaryFromPosts,
  computeSpearmanRho,
} from '@/lib/internal/research/analytics';
import { parseAnalyticsSummaryQuery } from '@/pages/api/internal/research/workspace/analytics/summary';
import { validateAnalyticsRefreshPayload } from '@/pages/api/internal/research/workspace/analytics/refresh';

const toUtc = (iso: string): number => Math.floor(new Date(iso).getTime() / 1000);

test('computeSpearmanRho handles positive and negative monotonic relationships', () => {
  const positive = computeSpearmanRho([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]);
  expect(positive.rho).toBe(1);
  expect(positive.n).toBe(5);

  const negative = computeSpearmanRho([1, 2, 3, 4, 5], [50, 40, 30, 20, 10]);
  expect(negative.rho).toBe(-1);
  expect(negative.n).toBe(5);
});

test('buildAnalyticsSummaryFromPosts bins users by posting frequency', () => {
  const posts = [
    { postId: 'a1', author: 'steady_user', createdUtc: toUtc('2026-02-01T10:00:00Z'), score: 10, numComments: 3, upvoteRatio: 0.8 },
    { postId: 'a2', author: 'steady_user', createdUtc: toUtc('2026-02-02T10:00:00Z'), score: 11, numComments: 2, upvoteRatio: 0.8 },
    { postId: 'a3', author: 'steady_user', createdUtc: toUtc('2026-02-03T10:00:00Z'), score: 12, numComments: 2, upvoteRatio: 0.8 },
    { postId: 'b1', author: 'very_user', createdUtc: toUtc('2026-02-04T01:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
    { postId: 'b2', author: 'very_user', createdUtc: toUtc('2026-02-04T02:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
    { postId: 'b3', author: 'very_user', createdUtc: toUtc('2026-02-04T03:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
    { postId: 'b4', author: 'very_user', createdUtc: toUtc('2026-02-04T04:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
    { postId: 'b5', author: 'very_user', createdUtc: toUtc('2026-02-04T05:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
    { postId: 'b6', author: 'very_user', createdUtc: toUtc('2026-02-04T06:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
    { postId: 'b7', author: 'very_user', createdUtc: toUtc('2026-02-04T07:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
    { postId: 'b8', author: 'very_user', createdUtc: toUtc('2026-02-04T08:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
    { postId: 'b9', author: 'very_user', createdUtc: toUtc('2026-02-04T09:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
    { postId: 'b10', author: 'very_user', createdUtc: toUtc('2026-02-04T10:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
    { postId: 'b11', author: 'very_user', createdUtc: toUtc('2026-02-04T11:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
    { postId: 'b12', author: 'very_user', createdUtc: toUtc('2026-02-04T12:00:00Z'), score: 6, numComments: 1, upvoteRatio: 0.7 },
  ];

  const summary = buildAnalyticsSummaryFromPosts(posts, {
    lookbackDays: 90,
    minPostAgeHours: 24,
    timezone: 'UTC',
    minPostsPerUser: 1,
  });

  const steadyBin = summary.frequencyBins.find((item) => item.bucket === 'steady (1-3/day)');
  const veryBin = summary.frequencyBins.find((item) => item.bucket === 'very aggressive (10+/day)');
  expect(steadyBin?.users).toBe(1);
  expect(veryBin?.users).toBe(1);
});

test('buildAnalyticsSummaryFromPosts adds low coverage caveat when engagement is sparse', () => {
  const posts = Array.from({ length: 40 }, (_, i) => ({
    postId: `p${i}`,
    author: i % 2 === 0 ? 'u1' : 'u2',
    createdUtc: toUtc(`2026-02-10T${String(i % 24).padStart(2, '0')}:00:00Z`),
    score: null,
    numComments: null,
    upvoteRatio: null,
  }));

  const summary = buildAnalyticsSummaryFromPosts(posts, {
    lookbackDays: 30,
    minPostAgeHours: 24,
    timezone: 'UTC',
    minPostsPerUser: 1,
  });

  expect(summary.coverage.bothCoverage).toBe(0);
  expect(summary.caveats.some((item) => item.includes('Low engagement coverage'))).toBe(true);
});

test('parseAnalyticsSummaryQuery clamps invalid values and falls back timezone', () => {
  const parsed = parseAnalyticsSummaryQuery({
    lookbackDays: '-5',
    minPostAgeHours: '999',
    minPostsPerUser: '0',
    timezone: 'Invalid/Timezone',
  });

  expect(parsed.lookbackDays).toBe(1);
  expect(parsed.minPostAgeHours).toBe(168);
  expect(parsed.minPostsPerUser).toBe(1);
  expect(parsed.timezone).toBe('UTC');
});

test('validateAnalyticsRefreshPayload enforces mode and limits', () => {
  const invalidMode = validateAnalyticsRefreshPayload({
    mode: 'invalid' as 'missing_only',
    maxPosts: 100,
    batchSize: 20,
  });
  expect(invalidMode.ok).toBe(false);

  const invalidLimit = validateAnalyticsRefreshPayload({
    mode: 'missing_only',
    maxPosts: 5000,
    batchSize: 20,
  });
  expect(invalidLimit.ok).toBe(false);

  const valid = validateAnalyticsRefreshPayload({
    mode: 'recent_only',
    maxPosts: 250,
    batchSize: 50,
  });
  expect(valid.ok).toBe(true);
});
