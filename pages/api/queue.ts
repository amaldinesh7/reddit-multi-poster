import type { NextApiRequest, NextApiResponse } from 'next';
import { redditClient, refreshAccessToken, submitPost, addSmartPrefixesToTitle, getSubredditRules } from '../../utils/reddit';
import { applyRateLimit, postingRateLimit } from '../../lib/rateLimit';
import { 
  QUEUE_LIMITS,
  formatFileSize,
} from '../../lib/queueLimits';
import { getUserId } from '../../lib/apiAuth';
import { logPostAttempt, classifyPostError } from '../../lib/supabase';
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
    
    console.log('Received form fields:', Object.keys(fields));
    console.log('Received files:', Object.keys(uploadedFiles));
    
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
    
    console.log('Parsed items count:', items.length);
    console.log('Items structure:', items.map((item, i) => ({ 
      index: i, 
      subreddit: item.subreddit, 
      kind: item.kind 
    })));

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
    console.log('Raw req.body:', req.body);
    console.log('Type of req.body:', typeof req.body);
    
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
    
    console.log('Body string:', bodyStr);
    let body;
    try {
      body = JSON.parse(bodyStr || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    console.log('Parsed body:', body);
    
    items = body.items || [];
    caption = body.caption || '';
    prefixes = body.prefixes || {};
    
    console.log('Extracted items:', items);
    console.log('Items length:', items.length);

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
  try {
    userId = await getUserId(req, res);
  } catch {
    // Don't block posting if user ID lookup fails
    console.warn('Failed to get user ID for analytics');
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

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      write({ index: i, status: 'posting', subreddit: item.subreddit });
      
      // Get subreddit rules to determine if prefixes are needed
      let subredditRules;
      try {
        subredditRules = await getSubredditRules(client, item.subreddit);
      } catch (error) {
        console.warn(`Failed to get rules for r/${item.subreddit}:`, error);
        subredditRules = undefined;
      }
      
      // Build title: [prefixes] caption [titleSuffix]
      let title = addSmartPrefixesToTitle(caption, item.subreddit, prefixes || {}, subredditRules);
      // Append per-subreddit title suffix if provided (e.g., "(f)", "25F", "[OC]")
      if (item.titleSuffix) {
        title = `${title} ${item.titleSuffix}`.trim();
      }
      
      try {
        // Get files if uploaded for this item (support multiple files)
        const itemFiles: File[] = [];
        
        // Check if there's a fileCount for this item (multiple files)
        const fileCountKey = `fileCount_${i}`;
        const fileCountField = Array.isArray(fields[fileCountKey]) ? fields[fileCountKey][0] : fields[fileCountKey];
        const fileCount = fileCountField ? parseInt(fileCountField as string) : 1;
        
        console.log(`Item ${i}: Looking for fileCount at key '${fileCountKey}', found:`, fileCountField);
        console.log(`Item ${i}: Expected file count: ${fileCount}`);
        
        // Collect all files for this item
        for (let fileIndex = 0; fileIndex < fileCount; fileIndex++) {
          const fileKey = `file_${i}_${fileIndex}`;
          console.log(`Item ${i}: Looking for file at key '${fileKey}', exists:`, !!files[fileKey]);
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
        
        // Fallback: check for single file with old format
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
        
        console.log(`Processing item ${i} for r/${item.subreddit}:`, {
          originalKind: item.kind,
          finalKind: postKind,
          filesCount: itemFiles.length,
          fileNames: itemFiles.map(f => f.name),
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
        
        console.log(`Post result for r/${item.subreddit}:`, result);
        
        // Log success for analytics (non-blocking, privacy-first)
        if (userId) {
          logPostAttempt({
            user_id: userId,
            subreddit_name: item.subreddit,
            post_kind: postKind,
            reddit_post_url: result.url || null,
            status: 'success',
          }).catch(() => {}); // Fire and forget
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
        console.error(`Error posting to r/${item.subreddit}:`, e);
        
        // Log error for analytics (non-blocking, privacy-first)
        if (userId) {
          logPostAttempt({
            user_id: userId,
            subreddit_name: item.subreddit,
            post_kind: item.kind,
            status: 'error',
            error_code: classifyPostError(msg),
          }).catch(() => {}); // Fire and forget
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
    res.status(500).end(JSON.stringify({ error: msg }));
  }
}
