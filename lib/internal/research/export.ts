import type { ResearchCandidate } from './types';

const csvEscape = (value: string): string => `"${value.replace(/"/g, '""')}"`;

export const buildCandidatesCsv = (rows: ResearchCandidate[]): string => {
  const header = [
    'username',
    'overallScore',
    'frequencyScore',
    'duplicateScore',
    'crossSubredditScore',
    'clusterCount',
    'maxClusterSize',
    'totalDuplicatePosts',
    'avgClusterSize',
    'subredditsCount',
    'hasProfileImage',
    'profilePostsPublic',
    'totalPostsScanned',
    'suggestedChannel',
    'noteText',
    'sampleLinks',
    'subreddits24h',
    'repeatedTitles',
  ].join(',');

  const lines = rows.map((row) =>
    [
      row.username,
      row.overallScore.toString(),
      row.frequencyScore.toString(),
      row.duplicateScore.toString(),
      row.crossSubredditScore.toString(),
      row.clusterCount.toString(),
      row.maxClusterSize.toString(),
      row.totalDuplicatePosts.toString(),
      row.avgClusterSize.toString(),
      row.subredditsCount.toString(),
      String(row.hasProfileImage),
      String(row.profilePostsPublic),
      row.totalPostsScanned.toString(),
      row.suggestedChannel,
      row.noteText,
      row.evidence.sampleLinks.join(' | '),
      row.evidence.subreddits24h.join(' | '),
      row.evidence.repeatedTitles.join(' | '),
    ]
      .map((cell) => csvEscape(cell))
      .join(',')
  );

  return [header, ...lines].join('\n');
};
