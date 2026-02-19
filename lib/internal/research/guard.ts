import type { NextApiResponse } from 'next';

export const isInternalResearchEnabled = (): boolean =>
  process.env.ENABLE_INTERNAL_RESEARCH === 'true';

export const assertInternalResearchApiEnabled = (
  res: NextApiResponse
): boolean => {
  if (isInternalResearchEnabled()) {
    return true;
  }
  res.status(404).json({ error: 'Not found' });
  return false;
};

export const isInternalResearchClientEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_ENABLE_INTERNAL_RESEARCH === 'true';
