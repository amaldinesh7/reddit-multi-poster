import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getResearchAccessToken } from '@/lib/internal/research/auth';
import { redditClient } from '@/utils/reddit';
import {
  insertOutreachMessage,
  updateOutreachTemplate,
} from '@/lib/internal/research/db';
import {
  buildOutreachMessage,
  extractApiErrorMessage,
  fetchSentMailboxMessages,
  findSentMessageFullname,
  hasPrivateMessagesScope,
  sendPrivateMessage,
} from '@/lib/internal/research/outreach';
import type {
  OutreachRecipient,
  OutreachSendRequest,
  OutreachSendResult,
} from '@/lib/internal/research/types';

const MAX_RECIPIENTS = 20;
const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isValidRecipient = (value: unknown): value is OutreachRecipient => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.username === 'string'
    && typeof record.suggestedChannel === 'string'
    && typeof record.overallScore === 'number';
};

export const validateSendPayload = (
  payload: OutreachSendRequest
): { ok: true; recipients: OutreachRecipient[]; subjectTemplate: string; bodyTemplate: string } | { ok: false; error: string } => {
  const recipients = Array.isArray(payload?.recipients)
    ? payload.recipients.filter(isValidRecipient)
    : [];
  const subjectTemplate = typeof payload?.subjectTemplate === 'string'
    ? payload.subjectTemplate.trim()
    : '';
  const bodyTemplate = typeof payload?.bodyTemplate === 'string'
    ? payload.bodyTemplate.trim()
    : '';

  if (!subjectTemplate || !bodyTemplate) {
    return { ok: false, error: 'subjectTemplate and bodyTemplate are required' };
  }
  if (recipients.length === 0) {
    return { ok: false, error: 'At least one recipient is required' };
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return { ok: false, error: `Maximum ${MAX_RECIPIENTS} recipients per request` };
  }

  return { ok: true, recipients, subjectTemplate, bodyTemplate };
};

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

  const validation = validateSendPayload(req.body as OutreachSendRequest);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const { recipients, subjectTemplate, bodyTemplate } = validation;

  updateOutreachTemplate({ subjectTemplate, bodyTemplate });

  const client = redditClient(token);
  const results: OutreachSendResult[] = [];

  for (const recipient of recipients) {
    const rendered = buildOutreachMessage(recipient, subjectTemplate, bodyTemplate);
    if (!rendered.subject || !rendered.body) {
      const message = 'Rendered message is empty; fix template placeholders';
      insertOutreachMessage({
        id: crypto.randomUUID(),
        username: recipient.username,
        status: 'failed',
        subject: rendered.subject,
        body: rendered.body,
        suggestedChannel: recipient.suggestedChannel,
        leadScore: recipient.overallScore,
        redditMessageFullname: null,
        errorMessage: message,
      });
      results.push({ username: recipient.username, status: 'failed', error: message });
      continue;
    }

    try {
      const sentAtUtc = Math.floor(Date.now() / 1000);
      await sendPrivateMessage(client, recipient.username, rendered.subject, rendered.body);
      await sleep(300);

      const sentMessages = await fetchSentMailboxMessages(client, 25);
      const fullname = findSentMessageFullname(sentMessages, {
        toUsername: recipient.username,
        subject: rendered.subject,
        body: rendered.body,
        sentAfterUtc: sentAtUtc,
      });

      insertOutreachMessage({
        id: crypto.randomUUID(),
        username: recipient.username,
        status: 'sent',
        subject: rendered.subject,
        body: rendered.body,
        suggestedChannel: recipient.suggestedChannel,
        leadScore: recipient.overallScore,
        redditMessageFullname: fullname,
        errorMessage: null,
      });
      results.push({ username: recipient.username, status: 'sent', error: null });
    } catch (error) {
      const message = extractApiErrorMessage(error);
      insertOutreachMessage({
        id: crypto.randomUUID(),
        username: recipient.username,
        status: 'failed',
        subject: rendered.subject,
        body: rendered.body,
        suggestedChannel: recipient.suggestedChannel,
        leadScore: recipient.overallScore,
        redditMessageFullname: null,
        errorMessage: message,
      });
      results.push({ username: recipient.username, status: 'failed', error: message });
    }

    await sleep(250);
  }

  const sent = results.filter((item) => item.status === 'sent').length;
  const failed = results.length - sent;

  res.status(200).json({
    sent,
    failed,
    total: results.length,
    results,
  });
}
