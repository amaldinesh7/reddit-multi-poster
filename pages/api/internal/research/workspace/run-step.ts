import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import {
  getActiveJobId,
  setActiveJobId,
  getResearchJob,
  createResearchJob,
  updateResearchJob,
  updateJobConfig,
  getJobStepStats,
  getWorkspaceSubreddits,
  markWorkspaceSubredditScanned,
  getSubredditPostCount,
} from '@/lib/internal/research/db';
import { getResearchAccessToken } from '@/lib/internal/research/auth';
import {
  COLLECT_BATCH_SIZES,
  type CollectBatchSize,
  type ResearchJobConfig,
  type ResearchStep,
} from '@/lib/internal/research/types';
import {
  runStepCollectPosts,
  runStepProfileUsers,
  runStepScoreAndRank,
} from '@/lib/internal/research/worker';

const VALID_STEPS: ResearchStep[] = ['collect_posts', 'profile_users', 'score_rank'];

export const parseCollectBatchSize = (raw: unknown): CollectBatchSize => {
  if (raw === undefined || raw === null || raw === '') return 10;
  const value = Number(raw);
  if (!Number.isFinite(value) || !COLLECT_BATCH_SIZES.includes(value as CollectBatchSize)) {
    throw new Error(`Invalid batchSize. Must be one of: ${COLLECT_BATCH_SIZES.join(', ')}`);
  }
  return value as CollectBatchSize;
};

const safeRun = (jobId: string, fn: () => Promise<void>, afterRun?: () => void): void => {
  fn()
    .then(() => { if (afterRun) afterRun(); })
    .catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Unexpected worker crash';
      updateResearchJob(jobId, {
        status: 'failed',
        error: msg,
        message: 'Step crashed unexpectedly — can be retried',
        stepStats: getJobStepStats(jobId),
      });
    });
};

const ensureActiveJob = (): { jobId: string; config: ResearchJobConfig } => {
  let jobId = getActiveJobId();
  let job = jobId ? getResearchJob(jobId) : null;

  if (!job) {
    const allSubs = getWorkspaceSubreddits().map((s) => s.subreddit);
    if (allSubs.length === 0) throw new Error('No subreddits in workspace. Add subreddits first.');
    const config: ResearchJobConfig = {
      subreddits: allSubs,
      postsPerSubreddit: 300,
      maxUsersToAnalyze: 5000,
      userPostsLimit: 200,
      lookbackHours: 24,
      lookbackDays: 7,
      includeNsfw: true,
      concurrency: 2,
    };
    jobId = crypto.randomUUID();
    createResearchJob(jobId, config);
    setActiveJobId(jobId);
    return { jobId, config };
  }

  const config: ResearchJobConfig = JSON.parse(job.configJson);
  const wsSubs = getWorkspaceSubreddits().map((s) => s.subreddit);
  const configSet = new Set(config.subreddits.map((s) => s.toLowerCase()));
  const newSubs = wsSubs.filter((s) => !configSet.has(s.toLowerCase()));
  if (newSubs.length > 0) {
    config.subreddits = [...config.subreddits, ...newSubs];
    updateJobConfig(job.id, config);
  }

  return { jobId: job.id, config };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (!assertInternalResearchApiEnabled(res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const step = req.body?.step as string | undefined;
  if (!step || !VALID_STEPS.includes(step as ResearchStep)) {
    res.status(400).json({ error: `Invalid step. Must be one of: ${VALID_STEPS.join(', ')}` });
    return;
  }
  const requestedStep = step as ResearchStep;

  try {
    const { jobId, config } = ensureActiveJob();
    const job = getResearchJob(jobId);
    if (job?.status === 'running') {
      res.status(409).json({ error: 'A step is already running' });
      return;
    }

    updateResearchJob(jobId, { status: 'queued', error: null, cancelRequested: 0 });

    if (requestedStep === 'score_rank') {
      safeRun(jobId, () => runStepScoreAndRank(jobId, config));
      res.status(202).json({ ok: true, step: requestedStep, jobId });
      return;
    }

    const token = await getResearchAccessToken(req, res);
    if (!token) {
      res.status(401).json({ error: 'Reddit authentication required' });
      return;
    }

    if (requestedStep === 'collect_posts') {
      const batchSize = parseCollectBatchSize(req.body?.batchSize);
      const pendingSubreddits = getWorkspaceSubreddits()
        .filter((subreddit) => subreddit.scanStatus === 'pending')
        .sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());

      if (pendingSubreddits.length === 0) {
        res.status(400).json({ error: 'No pending subreddits to scan. Add new subreddits first.' });
        return;
      }

      const targetSubreddits = pendingSubreddits.slice(0, batchSize).map((subreddit) => subreddit.subreddit);
      const collectConfig: ResearchJobConfig = { ...config, subreddits: targetSubreddits };

      const afterCollect = (): void => {
        for (const subreddit of targetSubreddits) {
          const count = getSubredditPostCount(jobId, subreddit);
          markWorkspaceSubredditScanned(subreddit, count);
        }
      };
      safeRun(jobId, () => runStepCollectPosts(jobId, token, collectConfig), afterCollect);
      res.status(202).json({
        ok: true,
        step: requestedStep,
        jobId,
        batchSize,
        targetCount: targetSubreddits.length,
      });
      return;
    } else {
      const rawConcurrency = Number(req.body?.concurrency);
      const concurrency = Number.isFinite(rawConcurrency) && rawConcurrency > 0
        ? Math.min(Math.round(rawConcurrency), 5)
        : 3;
      safeRun(jobId, () => runStepProfileUsers(jobId, token, config, concurrency));
    }

    res.status(202).json({ ok: true, step: requestedStep, jobId });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to run step' });
  }
}
