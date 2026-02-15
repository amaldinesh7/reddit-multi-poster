import type { NextApiRequest, NextApiResponse } from 'next';

type QueueItemInput = {
  subreddit: string;
};

type DemoQueueRequestBody = {
  items: QueueItemInput[];
  caption?: string;
  prefixes?: { f?: boolean; c?: boolean };
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const writeLine = (res: NextApiResponse, payload: unknown): void => {
  res.write(`${JSON.stringify(payload)}\n`);
};

const isRecordLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseBody = (req: NextApiRequest): DemoQueueRequestBody | null => {
  const body = req.body as unknown;
  if (!isRecordLike(body)) return null;
  if (!('items' in body) || !Array.isArray(body.items)) return null;

  const items = body.items
    .map((item): QueueItemInput | null => {
      if (!isRecordLike(item)) return null;
      const subreddit = item.subreddit;
      if (typeof subreddit !== 'string' || subreddit.trim().length === 0) return null;
      return { subreddit };
    })
    .filter((item): item is QueueItemInput => item !== null);

  if (items.length === 0) return null;

  return {
    items,
    caption: typeof body.caption === 'string' ? body.caption : undefined,
    prefixes: isRecordLike(body.prefixes) ? (body.prefixes as DemoQueueRequestBody['prefixes']) : undefined,
  };
};

/**
 * Demo-only queue processor.
 *
 * Purpose:
 * - Provide a safe, deterministic, streamed queue for demo/video capture.
 * - NEVER posts to Reddit.
 *
 * Enable client-side usage via NEXT_PUBLIC_QUEUE_DEMO_MODE=1 (see hooks/usePostingQueue.ts).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = parseBody(req);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const delaySeconds = 2;
  writeLine(res, { status: 'started', total: parsed.items.length });
  await sleep(700);

  for (let index = 0; index < parsed.items.length; index++) {
    const item = parsed.items[index];
    const subreddit = item.subreddit;

    writeLine(res, { index, status: 'posting', subreddit });
    await sleep(900);

    writeLine(res, {
      index,
      status: 'success',
      subreddit,
      url: `https://reddit.com/r/${subreddit}/comments/demo${index}`,
      id: `demo${index}`,
    });
    await sleep(600);

    if (index < parsed.items.length - 1) {
      writeLine(res, { index, status: 'waiting', delaySeconds });
      await sleep(delaySeconds * 1000);
    }
  }

  writeLine(res, { status: 'completed' });
  return res.end();
}

