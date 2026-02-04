/**
 * POST /api/queue/submit
 * 
 * Submit a new queue job for processing.
 * Uploads files to Supabase Storage and creates a job record.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
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
  QUEUE_JOB_CONSTANTS,
} from '../../../lib/queueJob';
import { QUEUE_LIMITS } from '../../../lib/queueLimits';

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

    const parsedItems: ParsedItem[] = JSON.parse(itemsJson);
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
    const prefixes = prefixesJson ? JSON.parse(prefixesJson) : {};

    // Generate a temporary job ID for file uploads
    // We'll use this as a folder name in storage
    const tempJobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Process files and upload to Supabase Storage
    const filePaths: QueueFileReference[] = [];
    const jobItems: QueueJobItem[] = [];

    for (let itemIndex = 0; itemIndex < parsedItems.length; itemIndex++) {
      const item = parsedItems[itemIndex];
      
      // Count files for this item
      const fileCountKey = `fileCount_${itemIndex}`;
      const fileCountField = Array.isArray(fields[fileCountKey]) 
        ? fields[fileCountKey][0] 
        : fields[fileCountKey];
      const expectedFileCount = fileCountField ? parseInt(fileCountField as string) : 0;

      let actualFileCount = 0;

      // Upload files for this item
      for (let fileIndex = 0; fileIndex < Math.max(expectedFileCount, 20); fileIndex++) {
        const fileKey = `file_${itemIndex}_${fileIndex}`;
        const uploadedFile = files[fileKey];
        
        if (!uploadedFile) {
          // Also try single file format
          if (fileIndex === 0) {
            const singleFileKey = `file_${itemIndex}`;
            const singleFile = files[singleFileKey];
            if (singleFile) {
              const file = Array.isArray(singleFile) ? singleFile[0] : singleFile;
              if (file && file.filepath) {
                const buffer = fs.readFileSync(file.filepath);
                const storagePath = await uploadQueueFile(
                  tempJobId,
                  itemIndex,
                  0,
                  buffer,
                  file.originalFilename || 'file',
                  file.mimetype || 'application/octet-stream'
                );
                
                filePaths.push({
                  itemIndex,
                  fileIndex: 0,
                  storagePath,
                  originalName: file.originalFilename || 'file',
                  mimeType: file.mimetype || 'application/octet-stream',
                  size: file.size || buffer.length,
                });
                actualFileCount = 1;
              }
            }
          }
          continue;
        }

        const file = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;
        if (!file || !file.filepath) continue;

        // Check file size
        if (file.size > QUEUE_LIMITS.MAX_SINGLE_FILE_SIZE_MB * 1024 * 1024) {
          return res.status(400).json({
            success: false,
            error: `File "${file.originalFilename}" exceeds maximum size of ${QUEUE_LIMITS.MAX_SINGLE_FILE_SIZE_MB}MB`,
          });
        }

        // Upload to Supabase Storage
        const buffer = fs.readFileSync(file.filepath);
        const storagePath = await uploadQueueFile(
          tempJobId,
          itemIndex,
          fileIndex,
          buffer,
          file.originalFilename || 'file',
          file.mimetype || 'application/octet-stream'
        );

        filePaths.push({
          itemIndex,
          fileIndex,
          storagePath,
          originalName: file.originalFilename || 'file',
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size || buffer.length,
        });
        actualFileCount++;
      }

      // Build job item (without File objects)
      jobItems.push({
        subreddit: item.subreddit,
        flairId: item.flairId,
        titleSuffix: item.titleSuffix,
        kind: item.kind,
        url: item.url,
        text: item.text,
        fileCount: actualFileCount,
      });
    }

    // Create the queue job in database
    const job = await createQueueJob(userId, jobItems, caption, prefixes, filePaths);

    // Update file paths to use actual job ID
    // Note: Files are already uploaded with tempJobId, but job.id is what we return
    // The file paths in the database already contain the correct paths

    console.log(`Created queue job ${job.id} with ${jobItems.length} items and ${filePaths.length} files`);

    return res.status(200).json({
      success: true,
      jobId: job.id,
    });
  } catch (error) {
    console.error('Failed to submit queue job:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit job';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
