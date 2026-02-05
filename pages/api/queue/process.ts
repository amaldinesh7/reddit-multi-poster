/**
 * POST /api/queue/process
 * 
 * Process a queue job. Called by client polling.
 * Processes one item at a time, streaming progress back.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { 
  redditClient, 
  refreshAccessToken, 
  submitPost, 
  addSmartPrefixesToTitle, 
  getSubredditRules 
} from '../../../utils/reddit';
import { getUserId } from '../../../lib/apiAuth';
import { logPostAttempt, classifyPostError } from '../../../lib/supabase';
import { addApiBreadcrumb } from '../../../lib/apiErrorHandler';
import {
  getQueueJob,
  claimQueueJob,
  updateJobProgress,
  completeQueueJob,
  failQueueJob,
  isJobCancelled,
  getJobItemFiles,
  generateWorkerId,
  canProcessJob,
  isJobFullyProcessed,
  getNextJobItem,
} from '../../../lib/queueService';
import { QueueJobResult, JobProgressUpdate } from '../../../lib/queueJob';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'Job ID required' });
  }

  try {
    // Get user ID
    const userId = await getUserId(req, res);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the job
    const job = await getQueueJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify ownership
    if (job.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if job can be processed
    if (!canProcessJob(job)) {
      return res.status(400).json({ 
        error: 'Job cannot be processed',
        status: job.status,
      });
    }

    // Check if already fully processed
    if (isJobFullyProcessed(job)) {
      await completeQueueJob(jobId);
      return res.status(200).json({ 
        status: 'completed',
        results: job.results,
      });
    }

    // Set up streaming response
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const write = (update: JobProgressUpdate) => {
      res.write(JSON.stringify(update) + '\n');
      if ('flush' in res && typeof res.flush === 'function') {
        res.flush();
      }
    };

    // Get Reddit access token
    let access = req.cookies['reddit_access'];
    const refresh = req.cookies['reddit_refresh'];

    if (!access && refresh) {
      try {
        const t = await refreshAccessToken(refresh);
        access = t.access_token;
      } catch {
        write({ type: 'error', jobId, error: 'Failed to refresh token' });
        res.end();
        return;
      }
    }

    if (!access) {
      write({ type: 'error', jobId, error: 'Unauthorized - please log in again' });
      res.end();
      return;
    }

    const client = redditClient(access);

    // Claim the job
    const workerId = generateWorkerId();
    const claimedJob = await claimQueueJob(jobId, workerId);
    if (!claimedJob) {
      write({ type: 'error', jobId, error: 'Failed to claim job - may be processed by another request' });
      res.end();
      return;
    }

    write({ type: 'status', jobId, status: 'processing', currentIndex: claimedJob.current_index });

    // Process items one at a time
    let currentJob = claimedJob;
    
    while (!isJobFullyProcessed(currentJob)) {
      // Check for cancellation
      if (await isJobCancelled(jobId)) {
        write({ type: 'status', jobId, status: 'cancelled' });
        res.end();
        return;
      }

      const itemIndex = currentJob.current_index;
      const item = getNextJobItem(currentJob);
      
      if (!item) {
        break;
      }

      write({ 
        type: 'progress', 
        jobId, 
        currentIndex: itemIndex,
      });

      let result: QueueJobResult;

      try {
        // Get subreddit rules for smart prefixes
        let subredditRules;
        try {
          subredditRules = await getSubredditRules(client, item.subreddit);
        } catch {
          subredditRules = undefined;
        }

        // Build title
        let title = addSmartPrefixesToTitle(
          currentJob.caption, 
          item.subreddit, 
          currentJob.prefixes, 
          subredditRules
        );
        if (item.titleSuffix) {
          title = `${title} ${item.titleSuffix}`.trim();
        }

        // Get files for this item from storage
        const itemFiles = await getJobItemFiles(currentJob, itemIndex);
        
        // Convert Blobs to File objects
        const files: File[] = [];
        for (const fileData of itemFiles) {
          const buffer = await fileData.file.arrayBuffer();
          const file = new File([buffer], fileData.name, { type: fileData.mimeType });
          files.push(file);
        }

        // Determine post kind
        let postKind = item.kind;
        if (files.length > 1) {
          postKind = 'gallery';
        }

        // Submit to Reddit
        const postResult = await submitPost(client, {
          subreddit: item.subreddit,
          title,
          kind: postKind,
          url: item.url,
          text: item.text,
          flair_id: item.flairId,
          files: files.length > 0 ? files : undefined,
          file: files.length === 1 ? files[0] : undefined,
        });

        result = {
          index: itemIndex,
          subreddit: item.subreddit,
          status: 'success',
          url: postResult.url,
          postedAt: new Date().toISOString(),
        };

        // Log for analytics
        logPostAttempt({
          user_id: userId,
          subreddit_name: item.subreddit,
          post_kind: postKind,
          reddit_post_url: postResult.url || null,
          status: 'success',
        }).catch(() => {});

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to post';
        
        // Capture error to Sentry
        Sentry.captureException(error, {
          tags: {
            component: 'queue.process',
            subreddit: item.subreddit,
          },
          extra: {
            jobId,
            itemIndex,
            totalItems: currentJob.items.length,
          },
        });
        
        addApiBreadcrumb('Post failed', { subreddit: item.subreddit, error: errorMessage }, 'error');

        result = {
          index: itemIndex,
          subreddit: item.subreddit,
          status: 'error',
          error: errorMessage,
          postedAt: new Date().toISOString(),
        };

        // Log for analytics
        logPostAttempt({
          user_id: userId,
          subreddit_name: item.subreddit,
          post_kind: item.kind,
          status: 'error',
          error_code: classifyPostError(errorMessage),
        }).catch(() => {});
      }

      // Update job progress
      const updatedJob = await updateJobProgress(jobId, itemIndex + 1, result);
      if (!updatedJob) {
        write({ type: 'error', jobId, error: 'Failed to update job progress' });
        res.end();
        return;
      }

      currentJob = updatedJob;

      // Send result
      write({ type: 'result', jobId, result });

      // Add delay between posts (if not the last item)
      if (!isJobFullyProcessed(currentJob)) {
        const delayMs = Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000;
        const delaySeconds = Math.round(delayMs / 1000);
        write({ type: 'waiting', jobId, waitSeconds: delaySeconds });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Mark job as completed
    await completeQueueJob(jobId);
    write({ type: 'complete', jobId, status: 'completed' });
    res.end();

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process job';
    
    // Capture error to Sentry
    Sentry.captureException(error, {
      tags: {
        component: 'queue.process',
        endpoint: '/api/queue/process',
      },
      extra: { jobId },
    });
    
    // Try to mark job as failed
    try {
      await failQueueJob(jobId as string, message);
    } catch {
      // Ignore cleanup errors
    }

    res.status(500).json({ error: message });
  }
}
