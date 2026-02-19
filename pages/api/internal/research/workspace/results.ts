import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { queryGlobalCandidates } from '@/lib/internal/research/db';

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  if (!assertInternalResearchApiEnabled(res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const minScore = Math.max(0, Number(req.query.minScore) || 0);
  const minSubreddits = Math.max(0, Number(req.query.minSubreddits) || 0);
  const duplicateOnly = req.query.duplicateOnly === 'true';
  const nsfwOnly = req.query.nsfwOnly === 'true';

  const result = queryGlobalCandidates({
    page,
    pageSize,
    minScore,
    minSubreddits,
    duplicateOnly,
    nsfwOnly,
  });

  res.status(200).json(result);
}
