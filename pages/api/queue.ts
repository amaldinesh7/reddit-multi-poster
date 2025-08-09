import type { NextApiRequest, NextApiResponse } from 'next';
import { redditClient, refreshAccessToken, submitPost, addPrefixesToTitle } from '../../utils/reddit';
import formidable from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } }; // Disable default body parser for file uploads

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  
  // Check if it's a file upload (multipart) or JSON
  const contentType = req.headers['content-type'] || '';
  let items: any[], caption: string, prefixes: any;
  let files: any = {};
  
  if (contentType.includes('multipart/form-data')) {
    // Parse form data (including files)
    const form = formidable({ multiples: true });
    const [fields, uploadedFiles] = await form.parse(req);
    
    const itemsJson = Array.isArray(fields.items) ? fields.items[0] : fields.items;
    const captionJson = Array.isArray(fields.caption) ? fields.caption[0] : fields.caption;
    const prefixesJson = Array.isArray(fields.prefixes) ? fields.prefixes[0] : fields.prefixes;
    
    if (!itemsJson) return res.status(400).json({ error: 'No items' });
    
    items = JSON.parse(itemsJson as string);
    caption = captionJson as string || '';
    prefixes = prefixesJson ? JSON.parse(prefixesJson as string) : {};
    files = uploadedFiles;
  } else {
    // Parse JSON body (fallback for URL-only posts)
    const body = JSON.parse(req.body || '{}');
    items = body.items || [];
    caption = body.caption || '';
    prefixes = body.prefixes || {};
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
      const title = addPrefixesToTitle(caption, prefixes || {});
      write({ index: i, status: 'posting', subreddit: item.subreddit });
      
      try {
        // Get file if uploaded for this item
        let file: File | undefined;
        const fileKey = `file_${i}`;
        if (files[fileKey]) {
          const uploadedFile = Array.isArray(files[fileKey]) ? files[fileKey][0] : files[fileKey];
          if (uploadedFile) {
            // Convert formidable file to File object
            const buffer = fs.readFileSync(uploadedFile.filepath);
            file = new File([buffer], uploadedFile.originalFilename || 'upload', {
              type: uploadedFile.mimetype || 'application/octet-stream'
            });
          }
        }
        
        const result = await submitPost(client, {
          subreddit: item.subreddit,
          title,
          kind: item.kind,
          url: item.url,
          text: item.text,
          flair_id: item.flairId,
          file,
        });
        
        console.log(`Post result for r/${item.subreddit}:`, result);
        
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
        write({ index: i, status: 'error', subreddit: item.subreddit, error: msg });
      }

      // Add random delay between posts (10-45 seconds)
      if (i < items.length - 1) { // Don't delay after the last post
        const delayMs = Math.floor(Math.random() * (45000 - 10000 + 1)) + 10000; // 10s to 45s
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