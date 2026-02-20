import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getResearchAccessToken } from '@/lib/internal/research/auth';
import { getOutreachTemplate, updateOutreachTemplate } from '@/lib/internal/research/db';

const normalizeTemplate = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (!assertInternalResearchApiEnabled(res)) return;

  const token = await getResearchAccessToken(req, res);
  if (!token) {
    res.status(401).json({ error: 'Reddit authentication required' });
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json(getOutreachTemplate());
    return;
  }

  if (req.method === 'PUT') {
    const subjectTemplate = normalizeTemplate(req.body?.subjectTemplate);
    const bodyTemplate = normalizeTemplate(req.body?.bodyTemplate);

    if (!subjectTemplate || !bodyTemplate) {
      res.status(400).json({ error: 'subjectTemplate and bodyTemplate are required' });
      return;
    }
    if (subjectTemplate.length > 300) {
      res.status(400).json({ error: 'subjectTemplate must be 300 characters or fewer' });
      return;
    }
    if (bodyTemplate.length > 5000) {
      res.status(400).json({ error: 'bodyTemplate must be 5000 characters or fewer' });
      return;
    }

    const saved = updateOutreachTemplate({ subjectTemplate, bodyTemplate });
    res.status(200).json(saved);
    return;
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  res.status(405).json({ error: 'Method not allowed' });
}
