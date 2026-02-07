import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { redditClient, refreshAccessToken, submitPost, addSmartPrefixesToTitle, getSubredditRules } from '../../utils/reddit';
import { applyRateLimit, postingRateLimit } from '../../lib/rateLimit';
import { 
  QUEUE_LIMITS,
  formatFileSize,
} from '../../lib/queueLimits';
import { getUserId } from '../../lib/apiAuth';
import { logPostAttempt, classifyPostError, isUserFirstPost } from '../../lib/supabase';
import { trackServerEvent } from '../../lib/posthog-server';
import { addApiBreadcrumb } from '../../lib/apiErrorHandler';
import formidable from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } }; // Disable default body parser for file uploads

// ============================================================================
// Validation Helpers
// ============================================================================

interface ValidationResult {
  valid: boolean;
  error?: string;
}

const validateBatchLimits = (
  items: unknown[],
  files: Record<string, unknown>
): ValidationResult => {
  // Check item count
  if (items.length > QUEUE_LIMITS.MAX_ITEMS_PER_BATCH) {
    return {
      valid: false,
      error: `Batch exceeds maximum of ${QUEUE_LIMITS.MAX_ITEMS_PER_BATCH} items. Received ${items.length}. Please split into smaller batches.`,
    };
  }

  // Check individual file sizes only (no batch size limit)
  const maxSingleFileSizeBytes = QUEUE_LIMITS.MAX_SINGLE_FILE_SIZE_MB * 1024 * 1024;

  for (const key of Object.keys(files)) {
    const fileArr = files[key];
    const fileList = Array.isArray(fileArr) ? fileArr : [fileArr];
    
    for (const file of fileList) {
      if (file && typeof file === 'object' && 'size' in file) {
        const fileSize = (file as { size: number }).size;
        
        // Check individual file size
        if (fileSize > maxSingleFileSizeBytes) {
          const fileName = (file as { originalFilename?: string }).originalFilename || 'unknown';
          return {
            valid: false,
            error: `File "${fileName}" (${formatFileSize(fileSize)}) exceeds maximum size of ${QUEUE_LIMITS.MAX_SINGLE_FILE_SIZE_MB}MB.`,
          };
        }
      }
    }
  }

  return { valid: true };
};

// ============================================================================
// API Handler
// ============================================================================

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  
  // Apply rate limiting for posting
  if (!applyRateLimit(req, res, postingRateLimit)) {
    return; // Response already sent by applyRateLimit
  }
  
  // Check if it's a file upload (multipart) or JSON
  const contentType = req.headers['content-type'] || '';
  let items: { 
    subreddit: string;
    flairId?: string;
    titleSuffix?: string;
    customTitle?: string;
    kind: string;
    url?: string;
    text?: string;
  }[];
  let caption: string;
  let prefixes: { f?: boolean; c?: boolean };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let files: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fields: Record<string, any> = {};
  
  if (contentType.includes('multipart/form-data')) {
    // Parse form data (including files)
    const form = formidable({ multiples: true });
    const [parsedFields, uploadedFiles] = await form.parse(req);
    fields = parsedFields as Record<string, string | string[]>;
    
    addApiBreadcrumb('Multipart form parsed', {
      fieldCount: Object.keys(fields).length,
      fileCount: Object.keys(uploadedFiles).length,
    });
    
    const itemsJson = Array.isArray(fields.items) ? fields.items[0] : fields.items;
    const captionJson = Array.isArray(fields.caption) ? fields.caption[0] : fields.caption;
    const prefixesJson = Array.isArray(fields.prefixes) ? fields.prefixes[0] : fields.prefixes;
    
    if (!itemsJson) return res.status(400).json({ error: 'No items' });
    
    try {
      items = JSON.parse(itemsJson as string);
      caption = captionJson as string || '';
      prefixes = prefixesJson ? JSON.parse(prefixesJson as string) : {};
    } catch {
      return res.status(400).json({ error: 'Invalid JSON in form data' });
    }
    files = uploadedFiles;
    
    addApiBreadcrumb('Queue items parsed', {
      itemCount: items.length,
      subreddits: items.map(item => item.subreddit),
    });

    // Validate batch limits for file uploads
    const validation = validateBatchLimits(items, files);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: validation.error,
        code: 'BATCH_LIMIT_EXCEEDED',
      });
    }
  } else {
    // Parse JSON body (fallback for URL-only posts)
    addApiBreadcrumb('Parsing JSON body');
    
    let bodyStr = '';
    if (typeof req.body === 'string') {
      bodyStr = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      bodyStr = req.body.toString();
    } else if (req.body) {
      bodyStr = JSON.stringify(req.body);
    } else {
      // Read from request stream
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      bodyStr = Buffer.concat(chunks).toString();
    }
    
    let body;
    try {
      body = JSON.parse(bodyStr || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    
    items = body.items || [];
    caption = body.caption || '';
    prefixes = body.prefixes || {};
    
    addApiBreadcrumb('JSON body parsed', {
      itemCount: items.length,
      hasCaption: !!caption,
    });

    // Validate batch limits for JSON requests (item count only, no files)
    if (items.length > QUEUE_LIMITS.MAX_ITEMS_PER_BATCH) {
      return res.status(400).json({ 
        error: `Batch exceeds maximum of ${QUEUE_LIMITS.MAX_ITEMS_PER_BATCH} items. Received ${items.length}. Please split into smaller batches.`,
        code: 'BATCH_LIMIT_EXCEEDED',
      });
    }
  }
  
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items' });
  
  // Set up streaming response
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // streaming-ish
  const write = (chunk: Record<string, unknown>) => {
    res.write(JSON.stringify(chunk) + '\n');
    // Force flush the response
    if ('flush' in res && typeof res.flush === 'function') {
      res.flush();
    }
  };

  let access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];
  
  // Get user ID for analytics logging (non-blocking)
  let userId: string | null = null;
  let isFirstPost = false;
  try {
    userId = await getUserId(req, res);
    if (userId) {
      Sentry.setUser({ id: userId });
      // Check if this is the user's first post (for activation tracking)
      isFirstPost = await isUserFirstPost(userId);
    }
  } catch {
    // Don't block posting if user ID lookup fails
    addApiBreadcrumb('User ID lookup failed (non-blocking)', {}, 'warning');
  }
  
  try {
    if (!access && refresh) {
      const t = await refreshAccessToken(refresh);
      access = t.access_token;
    }
    if (!access) {
      res.status(401).end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    const client = redditClient(access);

    // Send initial message to establish connection
    write({ status: 'started', total: items.length });
    
    // Track post submitted for engagement analytics
    if (userId) {
      // Determine if media is being uploaded
      const sharedFileCountField = Array.isArray(fields.sharedFileCount) 
        ? fields.sharedFileCount[0] 
        : fields.sharedFileCount;
      const sharedFileCount = sharedFileCountField ? parseInt(sharedFileCountField as string) : 0;
      const hasMedia = sharedFileCount > 0 || Object.keys(files).length > 0;
      
      trackServerEvent(userId, 'post_submitted', {
        subreddit_count: items.length,
        post_kind: items[0]?.kind || 'unknown',
      });
      
      // Track media upload if files were included
      if (hasMedia) {
        const mediaType = items[0]?.kind === 'video' ? 'video' : 
                         sharedFileCount > 1 ? 'gallery' : 'image';
        trackServerEvent(userId, 'media_uploaded', {
          media_type: mediaType,
          file_count: sharedFileCount || Object.keys(files).length,
        });
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      write({ index: i, status: 'posting', subreddit: item.subreddit });
      
      // Get subreddit rules to determine if prefixes are needed
      let subredditRules;
      try {
        subredditRules = await getSubredditRules(client, item.subreddit);
      } catch (error) {
        addApiBreadcrumb('Subreddit rules fetch failed', { subreddit: item.subreddit }, 'warning');
        subredditRules = undefined;
      }
      
      // Build title: [prefixes] caption/customTitle [titleSuffix]
      const baseTitle = item.customTitle || caption;
      let title = addSmartPrefixesToTitle(baseTitle, item.subreddit, prefixes || {}, subredditRules);
      // Append per-subreddit title suffix if provided (e.g., "(f)", "25F", "[OC]")
      if (item.titleSuffix) {
        title = `${title} ${item.titleSuffix}`.trim();
      }
      
      try {
        // Get files for this item (support shared files and multiple files)
        const itemFiles: File[] = [];
        
        // Check for shared files first (uploaded once, used by all items)
        // Frontend sends: sharedFile_0, sharedFile_1, etc. with sharedFileCount
        const sharedFileCountField = Array.isArray(fields.sharedFileCount) 
          ? fields.sharedFileCount[0] 
          : fields.sharedFileCount;
        const sharedFileCount = sharedFileCountField ? parseInt(sharedFileCountField as string) : 0;
        
        // Collect shared files (same files used for all items in the batch)
        for (let fileIndex = 0; fileIndex < sharedFileCount; fileIndex++) {
          const fileKey = `sharedFile_${fileIndex}`;
          if (files[fileKey]) {
            const uploadedFile = Array.isArray(files[fileKey]) ? files[fileKey][0] : files[fileKey];
            if (uploadedFile) {
              // Convert formidable file to File object
              const buffer = fs.readFileSync(uploadedFile.filepath);
              const file = new File([buffer], uploadedFile.originalFilename || 'upload', {
                type: uploadedFile.mimetype || 'application/octet-stream'
              });
              itemFiles.push(file);
            }
          }
        }
        
        // Fallback: check for old per-item file format (file_0_0, file_0_1, etc.)
        if (itemFiles.length === 0) {
          const fileCountKey = `fileCount_${i}`;
          const fileCountField = Array.isArray(fields[fileCountKey]) ? fields[fileCountKey][0] : fields[fileCountKey];
          const fileCount = fileCountField ? parseInt(fileCountField as string) : 1;
          
          for (let fileIndex = 0; fileIndex < fileCount; fileIndex++) {
            const fileKey = `file_${i}_${fileIndex}`;
            if (files[fileKey]) {
              const uploadedFile = Array.isArray(files[fileKey]) ? files[fileKey][0] : files[fileKey];
              if (uploadedFile) {
                const buffer = fs.readFileSync(uploadedFile.filepath);
                const file = new File([buffer], uploadedFile.originalFilename || 'upload', {
                  type: uploadedFile.mimetype || 'application/octet-stream'
                });
                itemFiles.push(file);
              }
            }
          }
        }
        
        // Fallback: check for single file with oldest format (file_0)
        if (itemFiles.length === 0) {
          const fileKey = `file_${i}`;
          if (files[fileKey]) {
            const uploadedFile = Array.isArray(files[fileKey]) ? files[fileKey][0] : files[fileKey];
            if (uploadedFile) {
              const buffer = fs.readFileSync(uploadedFile.filepath);
              const file = new File([buffer], uploadedFile.originalFilename || 'upload', {
                type: uploadedFile.mimetype || 'application/octet-stream'
              });
              itemFiles.push(file);
            }
          }
        }
        
        // Determine post kind based on number of files
        let postKind: 'self' | 'link' | 'image' | 'video' | 'gallery' = item.kind as 'self' | 'link' | 'image' | 'video' | 'gallery';
        if (itemFiles.length > 1) {
          postKind = 'gallery';
        }
        
        addApiBreadcrumb(`Processing post ${i + 1}/${items.length}`, {
          subreddit: item.subreddit,
          kind: postKind,
          hasFiles: itemFiles.length > 0,
        });
        
        const result = await submitPost(client, {
          subreddit: item.subreddit,
          title,
          kind: postKind,
          url: item.url,
          text: item.text,
          flair_id: item.flairId,
          files: itemFiles.length > 0 ? itemFiles : undefined,
          file: itemFiles.length === 1 ? itemFiles[0] : undefined,
        });
        
        addApiBreadcrumb('Post successful', {
          subreddit: item.subreddit,
          hasUrl: !!result.url,
        });
        
        // Log success for analytics (non-blocking, privacy-first)
        if (userId) {
          logPostAttempt({
            user_id: userId,
            subreddit_name: item.subreddit,
            post_kind: postKind,
            reddit_post_url: result.url || null,
            status: 'success',
          }).catch(() => {}); // Fire and forget
          
          // Track post success for engagement analytics
          trackServerEvent(userId, 'post_success', {
            post_kind: postKind,
          });
          
          // Track first post for activation funnel (only on first successful post in batch)
          if (isFirstPost) {
            trackServerEvent(userId, 'first_post_created', {
              subreddit_count: items.length,
              post_kind: postKind,
            });
            isFirstPost = false; // Only track once per batch
          }
        }
        
        write({ 
          index: i, 
          status: 'success', 
          subreddit: item.subreddit, 
          url: result.url, 
          id: result.id,
          debug: result.url ? undefined : 'No URL returned from Reddit API'
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed';
        
        // Capture error to Sentry
        Sentry.captureException(e, {
          tags: {
            component: 'queue.post',
            subreddit: item.subreddit,
          },
          extra: {
            postIndex: i,
            totalPosts: items.length,
            postKind: item.kind,
          },
        });
        
        addApiBreadcrumb('Post failed', {
          subreddit: item.subreddit,
          error: msg,
        }, 'error');
        
        // Log error for analytics (non-blocking, privacy-first)
        if (userId) {
          const errorCategory = classifyPostError(msg);
          logPostAttempt({
            user_id: userId,
            subreddit_name: item.subreddit,
            post_kind: item.kind,
            status: 'error',
            error_code: errorCategory,
          }).catch(() => {}); // Fire and forget
          
          // Track post failure for engagement analytics
          trackServerEvent(userId, 'post_failed', {
            post_kind: item.kind,
            error_category: errorCategory,
          });
        }
        
        write({ index: i, status: 'error', subreddit: item.subreddit, error: msg });
      }

      // Add random delay between posts (1-4 seconds)
      if (i < items.length - 1) { // Don't delay after the last post
        const delayMs = Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000; // 1s to 4s
        const delaySeconds = Math.round(delayMs / 1000);
        write({ index: i, status: 'waiting', subreddit: '', delaySeconds });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // Send completion message
    write({ status: 'completed' });
    res.end();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    
    // Capture critical queue error
    Sentry.captureException(e, {
      tags: {
        component: 'queue',
        endpoint: '/api/queue',
      },
      extra: {
        totalItems: items?.length,
      },
    });
    
    res.status(500).end(JSON.stringify({ error: msg }));
  }
}
