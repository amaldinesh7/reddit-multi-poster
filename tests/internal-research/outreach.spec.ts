import { expect, test } from '@playwright/test';
import {
  getOutreachSummaryByUsernames,
  insertOutreachMessage,
  upsertOutreachReply,
} from '@/lib/internal/research/db';
import {
  hasPrivateMessagesScope,
  matchInboxReplies,
  renderOutreachTemplate,
} from '@/lib/internal/research/outreach';
import { parseCollectBatchSize } from '@/pages/api/internal/research/workspace/run-step';
import { validateSendPayload } from '@/pages/api/internal/research/workspace/outreach/send';

const uniqueUser = (prefix: string): string => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

test('renderOutreachTemplate resolves username, channel, and lead score', () => {
  const rendered = renderOutreachTemplate(
    'Hey {{username}} in {{top_channel}} ({{lead_score}})',
    {
      username: 'alice',
      topChannel: 'r/reactjs',
      leadScore: 0.45678,
    }
  );

  expect(rendered).toBe('Hey alice in r/reactjs (0.457)');
});

test('parseCollectBatchSize validates supported batch values', () => {
  expect(parseCollectBatchSize(undefined)).toBe(10);
  expect(parseCollectBatchSize('20')).toBe(20);
  expect(() => parseCollectBatchSize('999')).toThrow(/Invalid batchSize/);
});

test('hasPrivateMessagesScope detects required oauth scope', () => {
  expect(hasPrivateMessagesScope('identity read privatemessages history')).toBe(true);
  expect(hasPrivateMessagesScope('identity read')).toBe(false);
  expect(hasPrivateMessagesScope(undefined)).toBe(false);
});

test('validateSendPayload rejects missing template and oversized batches', () => {
  const missingTemplate = validateSendPayload({
    recipients: [{ username: 'u1', suggestedChannel: 'reactjs', overallScore: 0.5 }],
    subjectTemplate: '',
    bodyTemplate: 'body',
  });
  expect(missingTemplate.ok).toBe(false);

  const tooManyRecipients = validateSendPayload({
    recipients: Array.from({ length: 21 }, (_, i) => ({
      username: `u${i}`,
      suggestedChannel: 'reactjs',
      overallScore: 0.1,
    })),
    subjectTemplate: 'subject',
    bodyTemplate: 'body',
  });
  expect(tooManyRecipients.ok).toBe(false);
});

test('matchInboxReplies links inbox replies with fullname and fallback subject match', () => {
  const inbox = [
    {
      fullname: 't4_reply_1',
      authorUsername: 'target_user',
      parentFullname: 't4_sent_1',
      subject: 'Re: hello',
      body: 'Thanks',
      createdUtc: 1_700_000_001,
    },
    {
      fullname: 't4_reply_2',
      authorUsername: 'target_user_2',
      parentFullname: null,
      subject: 'Re: intro',
      body: 'Interested',
      createdUtc: 1_700_000_002,
    },
  ];
  const sentByFullname = new Map<string, { username: string; subject: string }>();
  sentByFullname.set('t4_sent_1', { username: 'target_user', subject: 'hello' });
  const latestByUser = new Map<string, { subject: string }>();
  latestByUser.set('target_user_2', { subject: 'intro' });

  const matched = matchInboxReplies(inbox, sentByFullname, latestByUser);
  expect(matched).toHaveLength(2);
  expect(matched[0]?.matchedUsername).toBe('target_user');
  expect(matched[1]?.matchedUsername).toBe('target_user_2');
});

test('getOutreachSummaryByUsernames aggregates sent/failed/replied states', () => {
  const repliedUser = uniqueUser('replied');
  const failedUser = uniqueUser('failed');
  const untouchedUser = uniqueUser('untouched');

  insertOutreachMessage({
    id: crypto.randomUUID(),
    username: repliedUser,
    status: 'sent',
    subject: 'Subject',
    body: 'Body',
    suggestedChannel: 'reactjs',
    leadScore: 0.66,
    redditMessageFullname: 't4_sent_reply_user',
    errorMessage: null,
  });

  upsertOutreachReply({
    redditReplyFullname: `t4_reply_${crypto.randomUUID()}`,
    username: repliedUser,
    redditParentFullname: 't4_sent_reply_user',
    subject: 'Re: Subject',
    body: 'Reply text',
    createdUtc: Math.floor(Date.now() / 1000),
  });

  insertOutreachMessage({
    id: crypto.randomUUID(),
    username: failedUser,
    status: 'failed',
    subject: 'Subject',
    body: 'Body',
    suggestedChannel: 'nextjs',
    leadScore: 0.12,
    redditMessageFullname: null,
    errorMessage: 'Forbidden',
  });

  const summary = getOutreachSummaryByUsernames([repliedUser, failedUser, untouchedUser]);

  expect(summary.get(repliedUser)?.outreachStatus).toBe('replied');
  expect(summary.get(repliedUser)?.replyCount).toBeGreaterThanOrEqual(1);

  expect(summary.get(failedUser)?.outreachStatus).toBe('failed');
  expect(summary.get(failedUser)?.replyCount).toBe(0);

  expect(summary.get(untouchedUser)?.outreachStatus).toBe('not_contacted');
  expect(summary.get(untouchedUser)?.lastSentAt).toBeNull();
});
