import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { queryCandidates, updateOutreachNote } from '@/lib/internal/research/db';
import { getResearchAccessToken } from '@/lib/internal/research/auth';
import type { ResearchResultsQuery } from '@/lib/internal/research/types';

const parseQuery = (req: NextApiRequest): ResearchResultsQuery => ({
  page: Math.max(1, Number(req.query.page ?? 1)),
  pageSize: Math.min(100, Math.max(1, Number(req.query.pageSize ?? 25))),
  minScore: Math.max(0, Number(req.query.minScore ?? 0)),
  minSubreddits: Math.max(0, Number(req.query.minSubreddits ?? 0)),
  nsfwOnly: String(req.query.nsfwOnly ?? 'false') === 'true',
  duplicateOnly: String(req.query.duplicateOnly ?? 'false') === 'true',
});

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

  const id = req.query.id;
  if (typeof id !== 'string' || !id) {
    res.status(400).json({ error: 'Invalid job id' });
    return;
  }

  if (req.method === 'GET') {
    const query = parseQuery(req);
    const result = queryCandidates(id, query);
    res.status(200).json({ ...result, page: query.page, pageSize: query.pageSize });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body as { username?: string; noteText?: string };
    if (!body.username) {
      res.status(400).json({ error: 'username is required' });
      return;
    }
    updateOutreachNote(id, body.username, body.noteText ?? '');
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).json({ error: 'Method not allowed' });
}
