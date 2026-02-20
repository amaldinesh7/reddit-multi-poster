import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getResearchAccessToken } from '@/lib/internal/research/auth';
import { refreshWorkspacePostEngagement } from '@/lib/internal/research/analytics';
import type {
  AnalyticsRefreshMode,
  AnalyticsRefreshRequest,
} from '@/lib/internal/research/types';

const MAX_POSTS_LIMIT = 2000;
const MAX_BATCH_SIZE = 100;

export const validateAnalyticsRefreshPayload = (
  payload: AnalyticsRefreshRequest
): { ok: true; mode: AnalyticsRefreshMode; maxPosts: number; batchSize: number } | { ok: false; error: string } => {
  const modeRaw = typeof payload?.mode === 'string' ? payload.mode : 'missing_only';
  const mode = modeRaw === 'recent_only' ? 'recent_only' : modeRaw === 'missing_only' ? 'missing_only' : null;
  if (!mode) {
    return { ok: false, error: 'mode must be "missing_only" or "recent_only"' };
  }

  const maxPostsRaw = payload?.maxPosts ?? 500;
  const maxPosts = Number(maxPostsRaw);
  if (!Number.isFinite(maxPosts) || maxPosts <= 0) {
    return { ok: false, error: 'maxPosts must be a positive number' };
  }
  if (maxPosts > MAX_POSTS_LIMIT) {
    return { ok: false, error: `maxPosts must be <= ${MAX_POSTS_LIMIT}` };
  }

  const batchSizeRaw = payload?.batchSize ?? 25;
  const batchSize = Number(batchSizeRaw);
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    return { ok: false, error: 'batchSize must be a positive number' };
  }
  if (batchSize > MAX_BATCH_SIZE) {
    return { ok: false, error: `batchSize must be <= ${MAX_BATCH_SIZE}` };
  }

  return {
    ok: true,
    mode,
    maxPosts: Math.round(maxPosts),
    batchSize: Math.round(batchSize),
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (!assertInternalResearchApiEnabled(res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = await getResearchAccessToken(req, res);
  if (!token) {
    res.status(401).json({ error: 'Reddit authentication required' });
    return;
  }

  const validation = validateAnalyticsRefreshPayload(req.body as AnalyticsRefreshRequest);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }

  try {
    const result = await refreshWorkspacePostEngagement({
      token,
      mode: validation.mode,
      maxPosts: validation.maxPosts,
      batchSize: validation.batchSize,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to refresh post engagement',
    });
  }
}
