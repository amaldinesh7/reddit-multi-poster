import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserId } from '@/lib/apiAuth';
import { applyRateLimit, aiGenerationRateLimit } from '@/lib/rateLimit';
import {
  CopyKind,
  CopyTone,
  PreferredProvider,
  generateCopyOptions,
} from '@/lib/ai/copyGeneration';

interface GenerateCopyRequest {
  kind: CopyKind;
  count?: number;
  baseText?: string;
  globalTitle?: string;
  globalBody?: string;
  selectedSubreddits?: string[];
  subreddit?: string;
  mediaType?: 'self' | 'link' | 'image' | 'video' | 'gallery';
  userBrief?: string;
  tone?: CopyTone;
  preferredProvider?: PreferredProvider;
  previousTitles?: string[];
}

interface GenerateCopyResponse {
  success: boolean;
  data?: {
    options: string[];
    provider: 'gemini' | 'groq' | 'fallback';
    fallbackUsed: boolean;
  };
  error?: string;
}

const ALLOWED_TONES: CopyTone[] = ['straightforward', 'viral', 'discussion', 'excited', 'personal', 'humor', 'professional'];
const ALLOWED_PROVIDERS: PreferredProvider[] = ['auto', 'gemini', 'groq'];

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const sanitizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const sanitizeCount = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 3;
  if (value < 1) return 1;
  if (value > 3) return 3;
  return Math.floor(value);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateCopyResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  if (!applyRateLimit(req, res, aiGenerationRateLimit)) {
    return;
  }

  try {
    const userId = await getUserId(req, res);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const body = (req.body || {}) as GenerateCopyRequest;

    if (body.kind !== 'title' && body.kind !== 'description') {
      res.status(400).json({ success: false, error: 'Invalid kind. Use title or description.' });
      return;
    }

    if (body.tone && !ALLOWED_TONES.includes(body.tone)) {
      res.status(400).json({ success: false, error: 'Invalid tone option.' });
      return;
    }

    if (body.preferredProvider && !ALLOWED_PROVIDERS.includes(body.preferredProvider)) {
      res.status(400).json({ success: false, error: 'Invalid provider option.' });
      return;
    }

    if (body.selectedSubreddits && !isStringArray(body.selectedSubreddits)) {
      res.status(400).json({ success: false, error: 'selectedSubreddits must be a string array.' });
      return;
    }

    if (body.previousTitles && !isStringArray(body.previousTitles)) {
      res.status(400).json({ success: false, error: 'previousTitles must be a string array.' });
      return;
    }

    const result = await generateCopyOptions({
      kind: body.kind,
      count: sanitizeCount(body.count),
      baseText: sanitizeText(body.baseText),
      globalTitle: sanitizeText(body.globalTitle),
      globalBody: sanitizeText(body.globalBody),
      selectedSubreddits: body.selectedSubreddits || [],
      subreddit: sanitizeText(body.subreddit),
      mediaType: body.mediaType,
      userBrief: sanitizeText(body.userBrief),
      tone: body.tone || 'straightforward',
      preferredProvider: body.preferredProvider || 'auto',
      previousTitles: body.previousTitles,
    });

    res.status(200).json({
      success: true,
      data: {
        options: result.options,
        provider: result.provider,
        fallbackUsed: result.fallbackUsed,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate copy';
    res.status(500).json({ success: false, error: message });
  }
}
