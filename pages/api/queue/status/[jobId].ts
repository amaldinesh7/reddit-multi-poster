/**
 * GET /api/queue/status/[jobId]
 * 
 * Get the current status of a queue job.
 * Used for initial load after page refresh or reconnection.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserId } from '../../../../lib/apiAuth';
import { getQueueJob } from '../../../../lib/queueService';
import { JobStatusResponse } from '../../../../lib/queueJob';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<JobStatusResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ job: null, error: 'Method not allowed' });
  }

  const { jobId } = req.query;
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ job: null, error: 'Job ID required' });
  }

  try {
    // Get user ID
    const userId = await getUserId(req, res);
    if (!userId) {
      return res.status(401).json({ job: null, error: 'Unauthorized' });
    }

    // Get the job
    const job = await getQueueJob(jobId);
    if (!job) {
      return res.status(404).json({ job: null, error: 'Job not found' });
    }

    // Verify ownership
    if (job.user_id !== userId) {
      return res.status(403).json({ job: null, error: 'Access denied' });
    }

    return res.status(200).json({ job });
  } catch (error) {
    console.error('Failed to get queue job status:', error);
    const message = error instanceof Error ? error.message : 'Failed to get job status';
    return res.status(500).json({ job: null, error: message });
  }
}
