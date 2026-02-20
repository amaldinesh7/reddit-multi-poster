/**
 * POST /api/queue/submit
 * 
 * Submit a new queue job for processing.
 * 
 * Supports two submission modes:
 * 1. Direct Upload (recommended): Files are pre-uploaded to Supabase Storage by the client,
 *    then storage paths are sent in JSON body. Bypasses Vercel's 4.5MB payload limit.
 * 2. Legacy FormData: Files are sent in multipart form data (kept for backward compatibility).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import formidable from 'formidable';
import fs from 'fs';
import { getUserId } from '../../../lib/apiAuth';
import { getEntitlement, FREE_MAX_POST_ITEMS } from '../../../lib/entitlement';
import { uploadQueueFile, verifyQueueFileExists } from '../../../lib/supabase';
import { createQueueJob } from '../../../lib/queueService';
import {
  QueueJobItem,
  QueueFileReference,
  SubmitJobResponse,
} from '../../../lib/queueJob';
import { QUEUE_LIMITS } from '../../../lib/queueLimits';
import { addApiBreadcrumb } from '../../../lib/apiErrorHandler';

// Allow both JSON body and FormData
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb', // Only for JSON body (metadata only)
    },
  },
};

interface ParsedItem {
  subreddit: string;
  flairId?: string;
  titleSuffix?: string;
  customTitle?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  text?: string;
}

interface StoragePathInput {
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  itemIndex: number;
  fileIndex: number;
}

interface DirectUploadBody {
  items: ParsedItem[];
  caption: string;
  prefixes: Record<string, boolean>;
  jobFolder: string;
  storagePaths: StoragePathInput[];
}

const isDirectUploadRequest = (req: NextApiRequest): boolean => {
  const contentType = req.headers['content-type'] || '';
  return contentType.includes('application/json');
};

async function handleDirectUpload(
  req: NextApiRequest,
  res: NextApiResponse<SubmitJobResponse>,
  userId: string
): Promise<void> {
  const body = req.body as DirectUploadBody;

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ success: false, error: 'Items must be a non-empty array' });
    return;
  }

  // Only enforce limit for FREE users
  const entitlement = await getEntitlement(userId);
  if (entitlement === 'free' && body.items.length > FREE_MAX_POST_ITEMS) {
    res.status(400).json({
      success: false,
      error: `Free plan allows posting to ${FREE_MAX_POST_ITEMS} subreddits at once. Upgrade for unlimited.`,
    });
    return;
  }

  const { items, caption = '', prefixes = {}, jobFolder, storagePaths = [] } = body;

  // Verify storage paths exist (optional validation)
  const filePaths: QueueFileReference[] = [];
  for (const sp of storagePaths) {
    // Validate file size
    if (sp.fileSize > QUEUE_LIMITS.MAX_SINGLE_FILE_SIZE_MB * 1024 * 1024) {
      res.status(400).json({
        success: false,
        error: `File "${sp.fileName}" exceeds maximum size of ${QUEUE_LIMITS.MAX_SINGLE_FILE_SIZE_MB}MB`,
      });
      return;
    }

    filePaths.push({
      itemIndex: sp.itemIndex,
      fileIndex: sp.fileIndex,
      storagePath: sp.storagePath,
      originalName: sp.fileName,
      mimeType: sp.mimeType,
      size: sp.fileSize,
    });
  }

  // Build job items
  const jobItems: QueueJobItem[] = items.map(item => ({
    subreddit: item.subreddit,
    flairId: item.flairId,
    titleSuffix: item.titleSuffix,
    customTitle: item.customTitle,
    kind: item.kind,
    url: item.url,
    text: item.text,
    fileCount: storagePaths.length,
  }));

  // Create the queue job
  const job = await createQueueJob(userId, jobItems, caption, prefixes, filePaths);

  addApiBreadcrumb('Queue job created (direct upload)', {
    jobId: job.id,
    itemCount: jobItems.length,
    fileCount: filePaths.length,
  });

  res.status(200).json({ success: true, jobId: job.id });
}

async function handleFormDataUpload(
  req: NextApiRequest,
  res: NextApiResponse<SubmitJobResponse>,
  userId: string
): Promise<void> {
  // Parse form data
  const form = formidable({ multiples: true });
  const [fields, files] = await form.parse(req);

  // Extract items from form data
  const itemsJson = Array.isArray(fields.items) ? fields.items[0] : fields.items;
  if (!itemsJson) {
    res.status(400).json({ success: false, error: 'No items provided' });
    return;
  }

  let parsedItems: ParsedItem[];
  try {
    parsedItems = JSON.parse(itemsJson);
  } catch {
    res.status(400).json({ success: false, error: 'Invalid JSON in items field' });
    return;
  }
  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    res.status(400).json({ success: false, error: 'Items must be a non-empty array' });
    return;
  }

  // Only enforce limit for FREE users
  const entitlement = await getEntitlement(userId);
  if (entitlement === 'free' && parsedItems.length > FREE_MAX_POST_ITEMS) {
    res.status(400).json({
      success: false,
      error: `Free plan allows posting to ${FREE_MAX_POST_ITEMS} subreddits at once. Upgrade for unlimited.`,
    });
    return;
  }

  // Extract caption and prefixes
  const caption = Array.isArray(fields.caption) ? fields.caption[0] : fields.caption || '';
  const prefixesJson = Array.isArray(fields.prefixes) ? fields.prefixes[0] : fields.prefixes;
  let prefixes = {};
  if (prefixesJson) {
    try {
      prefixes = JSON.parse(prefixesJson);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid JSON in prefixes field' });
      return;
    }
  }

  // Generate meaningful folder path for file uploads
  const redditUsername = req.cookies['reddit_username'] || 'unknown';
  const dateStr = new Date().toISOString().split('T')[0];
  const shortId = Math.random().toString(36).slice(2, 8);
  const jobFolder = `${redditUsername}/${dateStr}/job_${shortId}`;

  // Process shared files
  const filePaths: QueueFileReference[] = [];
  const jobItems: QueueJobItem[] = [];

  const sharedFileCountField = Array.isArray(fields.sharedFileCount) 
    ? fields.sharedFileCount[0] 
    : fields.sharedFileCount;
  const sharedFileCount = sharedFileCountField ? parseInt(sharedFileCountField as string) : 0;

  for (let fileIndex = 0; fileIndex < sharedFileCount; fileIndex++) {
    const fileKey = `sharedFile_${fileIndex}`;
    const uploadedFile = files[fileKey];
    
    if (!uploadedFile) continue;

    const file = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;
    if (!file || !file.filepath) continue;

    if (file.size > QUEUE_LIMITS.MAX_SINGLE_FILE_SIZE_MB * 1024 * 1024) {
      res.status(400).json({
        success: false,
        error: `File "${file.originalFilename}" exceeds maximum size of ${QUEUE_LIMITS.MAX_SINGLE_FILE_SIZE_MB}MB`,
      });
      return;
    }

    const buffer = fs.readFileSync(file.filepath);
    const storagePath = await uploadQueueFile(
      jobFolder,
      -1,
      fileIndex,
      buffer,
      file.originalFilename || 'file',
      file.mimetype || 'application/octet-stream'
    );

    filePaths.push({
      itemIndex: -1,
      fileIndex,
      storagePath,
      originalName: file.originalFilename || 'file',
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size || buffer.length,
    });
  }

  // Build job items
  for (let itemIndex = 0; itemIndex < parsedItems.length; itemIndex++) {
    const item = parsedItems[itemIndex];
    
    jobItems.push({
      subreddit: item.subreddit,
      flairId: item.flairId,
      titleSuffix: item.titleSuffix,
      customTitle: item.customTitle,
      kind: item.kind,
      url: item.url,
      text: item.text,
      fileCount: sharedFileCount,
    });
  }

  const job = await createQueueJob(userId, jobItems, caption, prefixes, filePaths);

  addApiBreadcrumb('Queue job created (form data)', {
    jobId: job.id,
    itemCount: jobItems.length,
    fileCount: filePaths.length,
  });

  res.status(200).json({ success: true, jobId: job.id });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SubmitJobResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const userId = await getUserId(req, res);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (isDirectUploadRequest(req)) {
      await handleDirectUpload(req, res, userId);
    } else {
      await handleFormDataUpload(req, res, userId);
    }
  } catch (error) {
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
