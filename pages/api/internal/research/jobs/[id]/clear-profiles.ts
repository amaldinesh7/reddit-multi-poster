import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import {
  getResearchJob,
  updateResearchJob,
  clearJobProfiles,
  getJobStepStats,
} from '@/lib/internal/research/db';

/**
 * POST /api/internal/research/jobs/[id]/clear-profiles
 *
 * Deletes all cached user profiles for a job so Step 2 can be re-run
 * from scratch (e.g. after fixing an OAuth scope issue).
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
    res.status(409).json({ error: 'Cannot clear profiles while a step is running' });
    return;
  }

  const deleted = clearJobProfiles(id);

  updateResearchJob(id, {
    currentStep: 'profile_users',
    status: 'queued',
    progressPercent: 0,
    error: null,
    message: `Cleared ${deleted} cached profile(s) — ready to re-run Step 2`,
    stepStats: getJobStepStats(id),
  });

  res.status(200).json({ ok: true, deleted });
}
