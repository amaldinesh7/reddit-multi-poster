import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { queryCandidates } from '@/lib/internal/research/db';
import { buildCandidatesCsv } from '@/lib/internal/research/export';
import { getResearchAccessToken } from '@/lib/internal/research/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (!assertInternalResearchApiEnabled(res)) return;
  const token = await getResearchAccessToken(req, res);
  if (!token) {
    res.status(401).json({ error: 'Reddit authentication required' });
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const id = req.query.id;
  if (typeof id !== 'string' || !id) {
    res.status(400).json({ error: 'Invalid job id' });
    return;
  }

  const result = queryCandidates(id, {
    page: 1,
    pageSize: 10000,
    minScore: 0,
    minSubreddits: 0,
    duplicateOnly: false,
    nsfwOnly: false,
  });
  const csv = buildCandidatesCsv(result.rows);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="research-${id}.csv"`);
  res.status(200).send(csv);
}
