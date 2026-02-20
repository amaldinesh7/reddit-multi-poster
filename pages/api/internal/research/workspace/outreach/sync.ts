import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getResearchAccessToken } from '@/lib/internal/research/auth';
import { redditClient } from '@/utils/reddit';
import { listOutreachSentMessages, upsertOutreachReply } from '@/lib/internal/research/db';
import {
  fetchInboxReplies,
  hasPrivateMessagesScope,
  matchInboxReplies,
} from '@/lib/internal/research/outreach';

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

  if (!hasPrivateMessagesScope(req.cookies['reddit_scope'])) {
    res.status(403).json({
      error: 'Missing Reddit "privatemessages" scope. Reconnect your Reddit account and retry.',
    });
    return;
  }

  try {
    const sentMessages = listOutreachSentMessages(1000);
    if (sentMessages.length === 0) {
      res.status(200).json({ fetched: 0, matched: 0, inserted: 0 });
      return;
    }

    const sentByFullname = new Map<string, { username: string; subject: string }>();
    const latestSentByUsername = new Map<string, { subject: string }>();
    for (const message of sentMessages) {
      sentByFullname.set(message.redditMessageFullname, {
        username: message.username,
        subject: message.subject,
      });
      if (!latestSentByUsername.has(message.username)) {
        latestSentByUsername.set(message.username, { subject: message.subject });
      }
    }

    const client = redditClient(token);
    const inbox = await fetchInboxReplies(client, 100);
    const matched = matchInboxReplies(inbox, sentByFullname, latestSentByUsername);

    let inserted = 0;
    for (const entry of matched) {
      const didInsert = upsertOutreachReply({
        redditReplyFullname: entry.reply.fullname,
        username: entry.matchedUsername,
        redditParentFullname: entry.reply.parentFullname,
        subject: entry.reply.subject,
        body: entry.reply.body,
        createdUtc: entry.reply.createdUtc,
      });
      if (didInsert) inserted += 1;
    }

    res.status(200).json({
      fetched: inbox.length,
      matched: matched.length,
      inserted,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to sync outreach replies',
    });
  }
}
