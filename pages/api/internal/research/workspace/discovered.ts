import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getGlobalDiscoveredSubreddits, getWorkspaceSubreddits } from '@/lib/internal/research/db';

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  if (!assertInternalResearchApiEnabled(res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const wsSubs = getWorkspaceSubreddits().map((s) => s.subreddit);
  const discovered = getGlobalDiscoveredSubreddits(wsSubs);
  res.status(200).json({ subreddits: discovered });
}
