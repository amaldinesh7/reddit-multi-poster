import { test, expect } from '@playwright/test';
import { normalizeTitle, buildCandidateFromPosts } from '@/lib/internal/research/patterns';
import { buildCandidatesCsv } from '@/lib/internal/research/export';
import type { UserSubmission } from '@/lib/internal/research/types';

test('normalizeTitle strips punctuation and casing', () => {
  expect(normalizeTitle('Hello, WORLD!!!')).toBe('hello world');
});

test('buildCandidateFromPosts flags cross-subreddit duplicate activity', () => {
  const nowUtc = 1_700_000_000;
  const posts: UserSubmission[] = [
    {
      id: 'a',
      subreddit: 'sub1',
      title: 'Same title',
      selftext: '',
      url: 'https://i.redd.it/x.png',
      createdUtc: nowUtc - 60,
      over18: false,
      crosspostParent: null,
    },
    {
      id: 'b',
      subreddit: 'sub2',
      title: 'Same title',
      selftext: '',
      url: 'https://i.redd.it/x.png',
      createdUtc: nowUtc - 120,
      over18: false,
      crosspostParent: null,
    },
    {
      id: 'c',
      subreddit: 'sub3',
      title: 'Another title',
      selftext: '',
      url: 'https://i.redd.it/y.png',
      createdUtc: nowUtc - 180,
      over18: false,
      crosspostParent: null,
    },
  ];

  const candidate = buildCandidateFromPosts('user1', posts, nowUtc, 24, 7, true, true);
  expect(candidate).not.toBeNull();
  expect(candidate?.clusterCount).toBeGreaterThanOrEqual(1);
  expect(candidate?.subredditsCount).toBeGreaterThanOrEqual(3);
});

test('buildCandidatesCsv outputs header and values', () => {
  const csv = buildCandidatesCsv([
    {
      username: 'user1',
      frequencyScore: 0.5,
      duplicateScore: 0.6,
      crossSubredditScore: 0.7,
      overallScore: 0.61,
      clusterCount: 1,
      maxClusterSize: 2,
      totalDuplicatePosts: 2,
      avgClusterSize: 2,
      subredditsCount: 3,
      hasProfileImage: true,
      profilePostsPublic: true,
      totalPostsScanned: 50,
      evidence: {
        subreddits24h: ['sub1', 'sub2'],
        sampleLinks: ['https://reddit.com/comments/a'],
        repeatedTitles: ['same title'],
        duplicateClusters: 1,
        maxClusterSize: 2,
        hasNsfw: false,
      },
      suggestedChannel: 'r/sub1',
      noteText: 'note',
    },
  ]);
  expect(csv).toContain('username,overallScore');
  expect(csv).toContain('"user1"');
});
