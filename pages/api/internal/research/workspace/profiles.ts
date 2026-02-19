import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getGlobalProfilesList } from '@/lib/internal/research/db';

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  if (!assertInternalResearchApiEnabled(res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const result = getGlobalProfilesList(page, pageSize);

  res.status(200).json(result);
}
