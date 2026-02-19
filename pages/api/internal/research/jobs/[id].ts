import type { NextApiRequest, NextApiResponse } from 'next';
import {
  assertInternalResearchApiEnabled,
} from '@/lib/internal/research/guard';
import { getResearchJob, updateResearchJob } from '@/lib/internal/research/db';
import { getResearchAccessToken } from '@/lib/internal/research/auth';

const STALE_THRESHOLD_MS = 3 * 60 * 1000;

const isJobStale = (job: { status: string; updatedAt: string | null; startedAt: string | null }): boolean => {
  // Only 'running' jobs can be stale — 'queued' jobs are waiting for manual step trigger
  if (job.status !== 'running') return false;
  const lastActivity = job.updatedAt ?? job.startedAt;
  if (!lastActivity) return false;
  return Date.now() - new Date(lastActivity).getTime() > STALE_THRESHOLD_MS;
};

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
    const job = getResearchJob(id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    if (isJobStale(job)) {
      updateResearchJob(id, {
        status: 'failed',
        error: 'Job appears stalled (no progress for 3 minutes). Click "Force Restart" to resume.',
        finishedAt: new Date().toISOString(),
      });
      const updated = getResearchJob(id);
      res.status(200).json({ job: updated });
      return;
    }
    res.status(200).json({ job });
    return;
  }

  if (req.method === 'POST') {
    const action = typeof req.body?.action === 'string' ? req.body.action : 'cancel';
    if (action === 'force-restart') {
      updateResearchJob(id, {
        status: 'failed',
        error: 'Force restart requested',
        cancelRequested: 0,
        finishedAt: new Date().toISOString(),
      });
      res.status(200).json({ ok: true, action: 'force-restart' });
      return;
    }
    updateResearchJob(id, {
      cancelRequested: 1,
      message: 'Cancellation requested',
    });
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).json({ error: 'Method not allowed' });
}
