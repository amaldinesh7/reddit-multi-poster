import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getResearchJob, updateJobConfig } from '@/lib/internal/research/db';
import type { ResearchJobConfig } from '@/lib/internal/research/types';

/**
 * POST /api/internal/research/jobs/[id]/add-subreddits
 *
 * Appends new subreddits to the job's scan config (deduplicating).
 * The newly added subs will be in "pending" state — run Step 1 again
 * to collect posts from them.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (!assertInternalResearchApiEnabled(res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
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

  if (job.status === 'running') {
    res.status(409).json({ error: 'Cannot modify config while a step is running' });
    return;
  }

  const rawSubs = req.body?.subreddits;
  if (!Array.isArray(rawSubs) || rawSubs.length === 0) {
    res.status(400).json({ error: 'Body must contain a non-empty "subreddits" array of strings' });
    return;
  }

  const newSubs = rawSubs
    .map((s: unknown) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);

  if (newSubs.length === 0) {
    res.status(400).json({ error: 'No valid subreddit names provided' });
    return;
  }

  const config: ResearchJobConfig = JSON.parse(job.configJson);
  const existingLower = new Set(config.subreddits.map((s) => s.toLowerCase()));

  const added: string[] = [];
  for (const sub of newSubs) {
    if (!existingLower.has(sub.toLowerCase())) {
      config.subreddits.push(sub);
      existingLower.add(sub.toLowerCase());
      added.push(sub);
    }
  }

  if (added.length === 0) {
    res.status(200).json({ ok: true, added: 0, message: 'All subreddits already in config' });
    return;
  }

  updateJobConfig(id, config);

  res.status(200).json({
    ok: true,
    added: added.length,
    subreddits: added,
    totalSubreddits: config.subreddits.length,
  });
}
