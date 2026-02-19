import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getResearchJob, updateResearchJob, getJobStepStats } from '@/lib/internal/research/db';
import { getResearchAccessToken } from '@/lib/internal/research/auth';
import type { ResearchJobConfig, ResearchStep } from '@/lib/internal/research/types';
import {
  runStepCollectPosts,
  runStepProfileUsers,
  runStepScoreAndRank,
} from '@/lib/internal/research/worker';

const VALID_STEPS: ResearchStep[] = ['collect_posts', 'profile_users', 'score_rank'];

/** Safety net: if the worker crashes outside its own try/catch, mark the job as failed. */
const safeRun = (jobId: string, fn: () => Promise<void>): void => {
  fn().catch((error: unknown) => {
    const msg = error instanceof Error ? error.message : 'Unexpected worker crash';
    updateResearchJob(jobId, {
      status: 'failed',
      error: msg,
      message: 'Step crashed unexpectedly — can be retried',
      stepStats: getJobStepStats(jobId),
    });
  });
};

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

  const step = req.body?.step as string | undefined;
  if (!step || !VALID_STEPS.includes(step as ResearchStep)) {
    res.status(400).json({ error: `Invalid step. Must be one of: ${VALID_STEPS.join(', ')}` });
    return;
  }
  const requestedStep = step as ResearchStep;

  const job = getResearchJob(id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  if (job.status === 'running') {
    res.status(409).json({ error: 'A step is already running for this job' });
    return;
  }

  // No step ordering restrictions — any step can run anytime on whatever cached data exists.

  const config: ResearchJobConfig = JSON.parse(job.configJson);

  if (requestedStep === 'score_rank') {
    updateResearchJob(id, { status: 'queued', error: null, cancelRequested: 0 });
    safeRun(id, () => runStepScoreAndRank(id, config));
    res.status(202).json({ ok: true, step: requestedStep });
    return;
  }

  const token = await getResearchAccessToken(req, res);
  if (!token) {
    res.status(401).json({ error: 'Reddit authentication required' });
    return;
  }

  updateResearchJob(id, { status: 'queued', error: null, cancelRequested: 0 });

  if (requestedStep === 'collect_posts') {
    safeRun(id, () => runStepCollectPosts(id, token, config));
  } else {
    const rawConcurrency = Number(req.body?.concurrency);
    const concurrency = Number.isFinite(rawConcurrency) && rawConcurrency > 0
      ? Math.min(Math.round(rawConcurrency), 5)
      : 3;
    safeRun(id, () => runStepProfileUsers(id, token, config, concurrency));
  }

  res.status(202).json({ ok: true, step: requestedStep });
}
