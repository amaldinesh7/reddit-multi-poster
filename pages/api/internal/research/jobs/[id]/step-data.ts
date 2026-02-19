import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getResearchJob, getPostsSummaryBySubreddit, getProfilesList } from '@/lib/internal/research/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (!assertInternalResearchApiEnabled(res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const id = req.query.id;
  if (typeof id !== 'string' || !id) {
    res.status(400).json({ error: 'Invalid job id' });
    return;
  }

  const job = getResearchJob(id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const step = req.query.step as string | undefined;

  if (step === 'collect_posts') {
    const summary = getPostsSummaryBySubreddit(id);
    res.status(200).json({ step: 'collect_posts', data: summary });
    return;
  }

  if (step === 'profile_users') {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const result = getProfilesList(id, page, pageSize);
    res.status(200).json({ step: 'profile_users', page, pageSize, ...result });
    return;
  }

  if (step === 'score_rank') {
    res.status(200).json({
      step: 'score_rank',
      redirect: `/api/internal/research/jobs/${id}/results`,
    });
    return;
  }

  res.status(400).json({
    error: 'Invalid step parameter. Must be one of: collect_posts, profile_users, score_rank',
  });
}
