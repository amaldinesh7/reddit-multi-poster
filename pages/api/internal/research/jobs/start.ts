import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { createResearchJob, findLatestJobByConfig, updateResearchJob } from '@/lib/internal/research/db';
import type { ResearchJobConfig, StartJobRequest } from '@/lib/internal/research/types';
import { getResearchAccessToken } from '@/lib/internal/research/auth';

const MAX_SUBREDDITS = 100;

const sanitizeSubreddit = (value: string): string =>
  value
    .trim()
    .replace(/^['"\s]+|['"\s]+$/g, '')
    .replace(/^r\//i, '')
    .replace(/[^a-zA-Z0-9_]/g, '');

const parseConfig = (input: StartJobRequest): ResearchJobConfig => {
  const subreddits = input.subreddits
    .split(/[\n,]/)
    .map((item) => sanitizeSubreddit(item))
    .filter(Boolean);
  const uniqueSubreddits = Array.from(new Set(subreddits)).slice(0, MAX_SUBREDDITS);
  if (uniqueSubreddits.length === 0) {
    throw new Error('At least one subreddit is required.');
  }
  return {
    subreddits: uniqueSubreddits,
    postsPerSubreddit: Math.min(Math.max(input.postsPerSubreddit ?? 300, 20), 300),
    maxUsersToAnalyze: Math.min(Math.max(input.maxUsersToAnalyze ?? 5000, 50), 10000),
    userPostsLimit: Math.min(Math.max(input.userPostsLimit ?? 200, 50), 200),
    lookbackHours: Math.min(Math.max(input.lookbackHours ?? 24, 6), 72),
    lookbackDays: Math.min(Math.max(input.lookbackDays ?? 7, 3), 30),
    includeNsfw: input.includeNsfw ?? true,
    concurrency: input.concurrency === 1 ? 1 : 2,
  };
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

  const token = await getResearchAccessToken(req, res);
  if (!token) {
    res.status(401).json({ error: 'Reddit authentication required' });
    return;
  }

  try {
    const config = parseConfig(req.body as StartJobRequest);
    const configJson = JSON.stringify(config);
    const existingJob = findLatestJobByConfig(configJson);

    // Reuse completed jobs
    if (existingJob?.status === 'completed') {
      res.status(200).json({ jobId: existingJob.id, reused: true, status: 'completed' });
      return;
    }

    // Reuse running/queued jobs (they are already in progress via manual step control)
    if (existingJob && (existingJob.status === 'running' || existingJob.status === 'queued')) {
      const lastActivity = existingJob.updatedAt ?? existingJob.startedAt;
      const isStale = lastActivity && (Date.now() - new Date(lastActivity).getTime() > 3 * 60 * 1000);
      if (isStale) {
        updateResearchJob(existingJob.id, {
          status: 'queued',
          error: null,
          cancelRequested: 0,
          finishedAt: null,
          message: `Ready — resume from step: ${existingJob.currentStep ?? 'collect_posts'}`,
        });
      }
      res.status(200).json({ jobId: existingJob.id, reused: true, status: existingJob.status });
      return;
    }

    // Reuse failed/cancelled jobs — reset to queued for manual step control
    if (existingJob && (existingJob.status === 'failed' || existingJob.status === 'cancelled')) {
      updateResearchJob(existingJob.id, {
        status: 'queued',
        error: null,
        cancelRequested: 0,
        finishedAt: null,
        message: `Ready — resume from step: ${existingJob.currentStep ?? 'collect_posts'}`,
      });
      res.status(200).json({ jobId: existingJob.id, reused: true, status: 'queued' });
      return;
    }

    // Create a new job — do NOT auto-run any step
    const jobId = crypto.randomUUID();
    createResearchJob(jobId, config);
    res.status(201).json({ jobId, reused: false, status: 'created' });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid config',
    });
  }
}
