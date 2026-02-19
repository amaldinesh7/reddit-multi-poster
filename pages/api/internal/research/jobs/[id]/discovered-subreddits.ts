import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getResearchJob, getDiscoveredSubreddits } from '@/lib/internal/research/db';
import type { ResearchJobConfig } from '@/lib/internal/research/types';

/**
 * GET /api/internal/research/jobs/[id]/discovered-subreddits
 *
 * Returns subreddits extracted from profiled users' submissions that are
 * NOT already in the job's scan config. Only returns subs where 2+ distinct
 * profiled users have posted, sorted by user count descending.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (!assertInternalResearchApiEnabled(res)) return;

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

  const job = getResearchJob(id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const config: ResearchJobConfig = JSON.parse(job.configJson);
  const discovered = getDiscoveredSubreddits(id, config.subreddits);

  res.status(200).json({ subreddits: discovered });
}
