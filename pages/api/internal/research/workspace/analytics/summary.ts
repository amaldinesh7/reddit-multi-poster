import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getWorkspaceAnalyticsSummary } from '@/lib/internal/research/analytics';
import type { AnalyticsSummaryQuery } from '@/lib/internal/research/types';

const parsePositiveInt = (
  raw: unknown,
  fallback: number,
  min: number,
  max: number
): number => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
};

const isValidTimezone = (value: string): boolean => {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const parseAnalyticsSummaryQuery = (
  query: NextApiRequest['query']
): AnalyticsSummaryQuery => {
  const lookbackDays = parsePositiveInt(query.lookbackDays, 90, 1, 365);
  const minPostAgeHours = parsePositiveInt(query.minPostAgeHours, 24, 0, 168);
  const minPostsPerUser = parsePositiveInt(query.minPostsPerUser, 5, 1, 1000);
  const timezoneRaw = typeof query.timezone === 'string' ? query.timezone.trim() : 'UTC';
  const timezone = timezoneRaw.length > 0 && isValidTimezone(timezoneRaw)
    ? timezoneRaw
    : 'UTC';

  return {
    lookbackDays,
    minPostAgeHours,
    timezone,
    minPostsPerUser,
  };
};

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  if (!assertInternalResearchApiEnabled(res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const query = parseAnalyticsSummaryQuery(req.query);
    const summary = getWorkspaceAnalyticsSummary(query);
    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to compute analytics summary',
    });
  }
}
