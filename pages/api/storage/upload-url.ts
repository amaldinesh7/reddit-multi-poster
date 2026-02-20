import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createSignedUploadUrl,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/supabase';

interface UploadUrlRequest {
  fileName: string;
  mimeType: string;
  fileSize: number;
  jobFolder: string;
  itemIndex: number;
  fileIndex: number;
}

interface UploadUrlResponse {
  uploadUrl: string;
  token: string;
  storagePath: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadUrlResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const access = req.cookies['reddit_access'];
    const supabaseUserId = req.cookies['supabase_user_id'];
    if (!access) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      fileName,
      mimeType,
      fileSize,
      jobFolder,
      itemIndex,
      fileIndex,
    } = req.body as UploadUrlRequest;

    if (!fileName || !mimeType || !jobFolder || fileIndex === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'fileName, mimeType, jobFolder, and fileIndex are required',
      });
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({
        error: 'Invalid file type',
        details: `Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      });
    }

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: 'File too large',
        details: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }

    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);

    const prefix = itemIndex === -1 || itemIndex === undefined
      ? 'shared'
      : `item_${itemIndex}`;
    const storagePath = `${jobFolder}/${prefix}_${fileIndex}_${sanitizedFileName}`;

    const { signedUrl, token, path } = await createSignedUploadUrl(storagePath);

    return res.status(200).json({
      uploadUrl: signedUrl,
      token,
      storagePath: path,
    });
  } catch (error) {
    console.error('Error creating upload URL:', error);
    return res.status(500).json({
      error: 'Failed to create upload URL',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
