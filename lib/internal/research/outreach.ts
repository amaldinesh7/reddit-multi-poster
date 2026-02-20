import axios, { type AxiosInstance } from 'axios';
import type { OutreachRecipient } from './types';

const TEMPLATE_TOKEN_PATTERN = /\{\{\s*(username|top_channel|lead_score)\s*\}\}/gi;

export interface SentMailboxMessage {
  fullname: string;
  destUsername: string;
  subject: string;
  body: string;
  createdUtc: number;
}

export interface InboxReplyMessage {
  fullname: string;
  authorUsername: string;
  parentFullname: string | null;
  subject: string;
  body: string;
  createdUtc: number;
}

export interface MatchedInboxReply {
  reply: InboxReplyMessage;
  matchedUsername: string;
}

const normalizeUsername = (value: string): string =>
  value.trim().replace(/^u\//i, '').toLowerCase();

export const hasPrivateMessagesScope = (scopeRaw: string | null | undefined): boolean => {
  if (!scopeRaw) return false;
  const scopes = scopeRaw
    .split(/\s+/)
    .map((scope) => scope.trim().toLowerCase())
    .filter(Boolean);
  return scopes.includes('privatemessages');
};

export const renderOutreachTemplate = (
  template: string,
  variables: {
    username: string;
    topChannel: string;
    leadScore: number;
  }
): string => {
  return template.replace(TEMPLATE_TOKEN_PATTERN, (_match, rawToken: string) => {
    const token = rawToken.toLowerCase();
    if (token === 'username') return variables.username;
    if (token === 'top_channel') return variables.topChannel;
    if (token === 'lead_score') return variables.leadScore.toFixed(3);
    return '';
  });
};

export const buildOutreachMessage = (
  recipient: OutreachRecipient,
  subjectTemplate: string,
  bodyTemplate: string
): { subject: string; body: string } => {
  const topChannel = recipient.suggestedChannel
    ? `r/${recipient.suggestedChannel.replace(/^r\//i, '')}`
    : 'your subreddit';
  const vars = {
    username: recipient.username,
    topChannel,
    leadScore: recipient.overallScore,
  };
  return {
    subject: renderOutreachTemplate(subjectTemplate, vars).trim(),
    body: renderOutreachTemplate(bodyTemplate, vars).trim(),
  };
};

export const extractApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const jsonErrors = (error.response?.data as { json?: { errors?: unknown[] } } | undefined)?.json?.errors;
    if (Array.isArray(jsonErrors) && jsonErrors.length > 0) {
      const first = jsonErrors[0];
      if (Array.isArray(first) && first.length >= 2) {
        return String(first[1] || first[0] || 'Reddit API error');
      }
      return String(first);
    }
    if (status === 403) return 'Permission denied by Reddit API (missing scope or blocked action).';
    if (status === 401) return 'Reddit authentication expired. Reconnect your account and retry.';
    if (status === 429) return 'Reddit rate limit reached. Wait and retry.';
    if (typeof error.message === 'string' && error.message.trim()) return error.message;
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Unexpected outreach error';
};

export const sendPrivateMessage = async (
  client: AxiosInstance,
  toUsername: string,
  subject: string,
  body: string
): Promise<void> => {
  const form = new URLSearchParams();
  form.set('api_type', 'json');
  form.set('to', toUsername);
  form.set('subject', subject);
  form.set('text', body);

  const response = await client.post<{ json?: { errors?: unknown[] } }>('/api/compose', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const errors = response.data?.json?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    const message = Array.isArray(first)
      ? String(first[1] || first[0] || 'Reddit compose error')
      : String(first);
    throw new Error(message);
  }
};

const mapMailboxRows = (
  children: Array<{ data?: Record<string, unknown> }> | undefined
): SentMailboxMessage[] => {
  if (!Array.isArray(children)) return [];
  return children
    .map((item) => item.data)
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => ({
      fullname: String(row.name ?? ''),
      destUsername: normalizeUsername(String(row.dest ?? '')),
      subject: String(row.subject ?? ''),
      body: String(row.body ?? ''),
      createdUtc: Number(row.created_utc ?? 0),
    }))
    .filter((row) => row.fullname.length > 0 && row.destUsername.length > 0);
};

export const fetchSentMailboxMessages = async (
  client: AxiosInstance,
  limit: number = 25
): Promise<SentMailboxMessage[]> => {
  const response = await client.get<{ data?: { children?: Array<{ data?: Record<string, unknown> }> } }>(
    '/message/sent',
    { params: { limit: Math.max(1, Math.min(limit, 100)), raw_json: 1 } }
  );
  return mapMailboxRows(response.data?.data?.children);
};

export const findSentMessageFullname = (
  sentMessages: SentMailboxMessage[],
  args: {
    toUsername: string;
    subject: string;
    body: string;
    sentAfterUtc: number;
  }
): string | null => {
  const normalizedTo = normalizeUsername(args.toUsername);
  const subject = args.subject.trim();
  const body = args.body.trim();

  for (const row of sentMessages) {
    if (row.destUsername !== normalizedTo) continue;
    if (row.createdUtc < args.sentAfterUtc - 120) continue;
    if (row.subject.trim() !== subject) continue;
    if (row.body.trim() !== body) continue;
    return row.fullname;
  }

  return null;
};

export const fetchInboxReplies = async (
  client: AxiosInstance,
  limit: number = 100
): Promise<InboxReplyMessage[]> => {
  const response = await client.get<{ data?: { children?: Array<{ data?: Record<string, unknown> }> } }>(
    '/message/inbox',
    { params: { limit: Math.max(1, Math.min(limit, 100)), raw_json: 1 } }
  );

  const children = response.data?.data?.children;
  if (!Array.isArray(children)) return [];

  return children
    .map((item) => item.data)
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .filter((row) => row.was_comment !== true)
    .map((row) => ({
      fullname: String(row.name ?? ''),
      authorUsername: normalizeUsername(String(row.author ?? '')),
      parentFullname: row.first_message_name ? String(row.first_message_name) : null,
      subject: String(row.subject ?? ''),
      body: String(row.body ?? ''),
      createdUtc: Number(row.created_utc ?? 0),
    }))
    .filter((row) => row.fullname.length > 0 && row.authorUsername.length > 0);
};

const normalizeSubject = (subject: string): string =>
  subject.trim().replace(/^re:\s*/i, '').toLowerCase();

export const matchInboxReplies = (
  inboxReplies: InboxReplyMessage[],
  sentByFullname: Map<string, { username: string; subject: string }>,
  latestSentByUsername?: Map<string, { subject: string }>
): MatchedInboxReply[] => {
  const matched: MatchedInboxReply[] = [];

  for (const reply of inboxReplies) {
    if (reply.parentFullname) {
      const sent = sentByFullname.get(reply.parentFullname);
      if (sent) {
        matched.push({
          reply,
          matchedUsername: sent.username,
        });
        continue;
      }
    }

    const fallback = latestSentByUsername?.get(reply.authorUsername);
    if (!fallback) continue;
    if (normalizeSubject(reply.subject) !== normalizeSubject(fallback.subject)) continue;

    matched.push({
      reply,
      matchedUsername: reply.authorUsername,
    });
  }

  return matched;
};
