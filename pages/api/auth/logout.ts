import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Set-Cookie', [
    serialize('reddit_access', '', { path: '/', maxAge: 0 }),
    serialize('reddit_refresh', '', { path: '/', maxAge: 0 }),
  ]);
  res.status(200).json({ ok: true });
} 