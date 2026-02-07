import type { NextApiRequest, NextApiResponse } from 'next';
import { getPricingForRequest } from '@/lib/pricing';
import { getPricingAmountsFromEnv } from '@/lib/pricingConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pricing = getPricingForRequest(req, getPricingAmountsFromEnv());
  return res.status(200).json({ pricing });
}

