/**
 * POST /api/queue/cancel/[jobId]
 * 
 * Cancel a running or pending queue job.
 * Cleans up files and marks job as cancelled.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { getUserId } from '../../../../lib/apiAuth';
import { cancelQueueJob } from '../../../../lib/queueService';
import { CancelJobResponse } from '../../../../lib/queueJob';
import { addApiBreadcrumb } from '../../../../lib/apiErrorHandler';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CancelJobResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { jobId } = req.query;
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ success: false, error: 'Job ID required' });
  }

  try {
    // Get user ID
    const userId = await getUserId(req, res);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Cancel the job
    const success = await cancelQueueJob(jobId, userId);
    
    if (!success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to cancel job - it may already be completed or cancelled' 
      });
    }

    addApiBreadcrumb('Queue job cancelled', { jobId });
    return res.status(200).json({ success: true });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'queue.cancel' },
      extra: { jobId },
    });
    const message = error instanceof Error ? error.message : 'Failed to cancel job';
    return res.status(500).json({ success: false, error: message });
  }
}
