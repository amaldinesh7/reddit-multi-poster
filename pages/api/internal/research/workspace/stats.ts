import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getWorkspaceStats, getActiveJobId, getResearchJob } from '@/lib/internal/research/db';

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  if (!assertInternalResearchApiEnabled(res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const stats = getWorkspaceStats();
  const activeJobId = getActiveJobId();
  const activeJob = activeJobId ? getResearchJob(activeJobId) : null;

  res.status(200).json({
    ...stats,
    activeJobId,
    activeJob: activeJob
      ? {
          id: activeJob.id,
          status: activeJob.status,
          progressPercent: activeJob.progressPercent,
          message: activeJob.message,
          error: activeJob.error,
          startedAt: activeJob.startedAt,
          updatedAt: activeJob.updatedAt,
          currentStep: activeJob.currentStep,
          stepStats: activeJob.stepStats,
          configJson: activeJob.configJson,
        }
      : null,
  });
}
