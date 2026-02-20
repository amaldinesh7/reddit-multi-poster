import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import {
  getWorkspaceSubreddits,
  addWorkspaceSubreddits,
  removeWorkspaceSubreddit,
} from '@/lib/internal/research/db';

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  if (!assertInternalResearchApiEnabled(res)) return;

  if (req.method === 'GET') {
    const subreddits = getWorkspaceSubreddits();
    res.status(200).json({ subreddits });
    return;
  }

  if (req.method === 'POST') {
    const raw = req.body?.subreddits;
    if (!raw || typeof raw !== 'string') {
      res.status(400).json({ error: 'subreddits (newline/comma separated string) is required' });
      return;
    }
    const sanitize = (v: string): string =>
      v.trim().replace(/^['"\s]+|['"\s]+$/g, '').replace(/^r\//i, '').replace(/[^a-zA-Z0-9_]/g, '');
    const parsed = raw
      .split(/[\n,]/)
      .map(sanitize)
      .filter(Boolean);
    const unique = Array.from(new Set(parsed));
    if (unique.length === 0) {
      res.status(400).json({ error: 'No valid subreddits provided' });
      return;
    }
    const added = addWorkspaceSubreddits(unique);
    res.status(200).json({ added, total: getWorkspaceSubreddits().length });
    return;
  }

  if (req.method === 'DELETE') {
    const sub = req.body?.subreddit;
    if (!sub || typeof sub !== 'string') {
      res.status(400).json({ error: 'subreddit is required' });
      return;
    }
    removeWorkspaceSubreddit(sub);
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  res.status(405).json({ error: 'Method not allowed' });
}
