/**
 * POST /api/queue/submit
 * 
 * Submit a new queue job for processing.
 * Uploads files to Supabase Storage and creates a job record.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import formidable from 'formidable';
import fs from 'fs';
import { getUserId } from '../../../lib/apiAuth';
import { getEntitlement, FREE_MAX_POST_ITEMS } from '../../../lib/entitlement';
import { uploadQueueFile } from '../../../lib/supabase';
import { createQueueJob } from '../../../lib/queueService';
import {
  QueueJobItem,
  QueueFileReference,
  SubmitJobResponse,
} from '../../../lib/queueJob';
import { QUEUE_LIMITS } from '../../../lib/queueLimits';
import { addApiBreadcrumb } from '../../../lib/apiErrorHandler';

// Disable default body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

interface ParsedItem {
  subreddit: string;
  flairId?: string;
  titleSuffix?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  text?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SubmitJobResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Get user ID
    const userId = await getUserId(req, res);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Parse form data
    const form = formidable({ multiples: true });
    const [fields, files] = await form.parse(req);

    // Extract items from form data
    const itemsJson = Array.isArray(fields.items) ? fields.items[0] : fields.items;
    if (!itemsJson) {
      return res.status(400).json({ success: false, error: 'No items provided' });
    }

    let parsedItems: ParsedItem[];
    try {
      parsedItems = JSON.parse(itemsJson);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid JSON in items field' });
    }
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Items must be a non-empty array' });
    }

    // Only enforce limit for FREE users - paid users have no limit
    const entitlement = await getEntitlement(userId);
    if (entitlement === 'free' && parsedItems.length > FREE_MAX_POST_ITEMS) {
      return res.status(400).json({
        success: false,
        error: `Free plan allows posting to ${FREE_MAX_POST_ITEMS} subreddits at once. Upgrade for unlimited.`,
      });
    }

    // Extract caption and prefixes
    const caption = Array.isArray(fields.caption) ? fields.caption[0] : fields.caption || '';
    const prefixesJson = Array.isArray(fields.prefixes) ? fields.prefixes[0] : fields.prefixes;
    let prefixes = {};
    if (prefixesJson) {
      try {
        prefixes = JSON.parse(prefixesJson);
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid JSON in prefixes field' });
      }
    }

    // Generate meaningful folder path for file uploads
    // Format: {username}/{date}/job_{shortId}/
    const redditUsername = req.cookies['reddit_username'] || 'unknown';
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const shortId = Math.random().toString(36).slice(2, 8);
    const jobFolder = `${redditUsername}/${dateStr}/job_${shortId}`;

    // Process shared files (uploaded once, used by all items)
    const filePaths: QueueFileReference[] = [];
    const jobItems: QueueJobItem[] = [];

    // Get shared file count from form data
    const sharedFileCountField = Array.isArray(fields.sharedFileCount) 
      ? fields.sharedFileCount[0] 
      : fields.sharedFileCount;
    const sharedFileCount = sharedFileCountField ? parseInt(sharedFileCountField as string) : 0;

    // Upload shared files once (itemIndex = -1 indicates shared files)
    for (let fileIndex = 0; fileIndex < sharedFileCount; fileIndex++) {
      const fileKey = `sharedFile_${fileIndex}`;
      const uploadedFile = files[fileKey];
      
      if (!uploadedFile) continue;

      const file = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;
      if (!file || !file.filepath) continue;

      // Check file size
      if (file.size > QUEUE_LIMITS.MAX_SINGLE_FILE_SIZE_MB * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: `File "${file.originalFilename}" exceeds maximum size of ${QUEUE_LIMITS.MAX_SINGLE_FILE_SIZE_MB}MB`,
        });
      }

      // Upload to Supabase Storage (shared files use itemIndex = -1)
      const buffer = fs.readFileSync(file.filepath);
      const storagePath = await uploadQueueFile(
        jobFolder,
        -1, // -1 indicates this is a shared file
        fileIndex,
        buffer,
        file.originalFilename || 'file',
        file.mimetype || 'application/octet-stream'
      );

      filePaths.push({
        itemIndex: -1, // Shared file indicator
        fileIndex,
        storagePath,
        originalName: file.originalFilename || 'file',
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size || buffer.length,
      });
    }

    // Build job items (all items share the same files)
    for (let itemIndex = 0; itemIndex < parsedItems.length; itemIndex++) {
      const item = parsedItems[itemIndex];
      
      jobItems.push({
        subreddit: item.subreddit,
        flairId: item.flairId,
        titleSuffix: item.titleSuffix,
        kind: item.kind,
        url: item.url,
        text: item.text,
        fileCount: sharedFileCount, // All items use the shared files
      });
    }

    // Create the queue job in database
    const job = await createQueueJob(userId, jobItems, caption, prefixes, filePaths);

    // Log successful job creation
    addApiBreadcrumb('Queue job created', {
      jobId: job.id,
      itemCount: jobItems.length,
      fileCount: filePaths.length,
    });

    return res.status(200).json({
      success: true,
      jobId: job.id,
    });
  } catch (error) {
    // Capture error to Sentry with context
    Sentry.captureException(error, {
      tags: { 
        component: 'queue.submit',
        endpoint: '/api/queue/submit',
      },
    });
    
    const message = error instanceof Error ? error.message : 'Failed to submit job';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
