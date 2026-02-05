/**
 * POST /api/webhooks/dodo
 * Dodo Payments webhook: payment.succeeded → set user entitlement to paid.
 * Uses Standard Webhooks: verify webhook-signature (HMAC SHA256 of webhook-id.timestamp.body).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import crypto from 'crypto';
import { createServerSupabaseClient } from '../../../lib/supabase';
import { invalidateEntitlementCache } from '../../../lib/entitlement';
import { addApiBreadcrumb } from '../../../lib/apiErrorHandler';

export const config = {
  api: { bodyParser: false },
};

interface DodoWebhookPayload {
  business_id?: string;
  type: string;
  timestamp?: string;
  data?: {
    payload_type?: string;
    payment_id?: string;
    metadata?: Record<string, string>;
    status?: string;
    [key: string]: unknown;
  };
}

function getRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Maximum age for webhook timestamps (5 minutes) to prevent replay attacks */
const WEBHOOK_TOLERANCE_SECONDS = 300;

function verifySignature(
  rawBody: string,
  webhookId: string,
  webhookTimestamp: string,
  webhookSignature: string,
  secret: string
): { valid: boolean; error?: string } {
  // Check timestamp freshness to prevent replay attacks
  const timestampSeconds = parseInt(webhookTimestamp, 10);
  if (isNaN(timestampSeconds)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }
  
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSeconds) > WEBHOOK_TOLERANCE_SECONDS) {
    return { valid: false, error: 'Timestamp too old or in future' };
  }

  // Standard Webhooks format: "v1,<base64_signature>" (may have multiple space-separated entries)
  // Extract the base64 signature from the v1 entry
  const signatures = webhookSignature.split(' ');
  let sig: string | undefined;
  
  for (const entry of signatures) {
    const trimmed = entry.trim();
    if (trimmed.startsWith('v1,')) {
      sig = trimmed.substring(3); // Remove "v1," prefix
      break;
    }
  }
  
  if (!sig) {
    // Fallback: try comma-split for single entry format
    const parts = webhookSignature.split(',');
    sig = parts.length > 1 ? parts[1]?.trim() : webhookSignature.trim();
  }

  if (!sig) {
    return { valid: false, error: 'Could not extract signature' };
  }

  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expectedBuffer = crypto.createHmac('sha256', secret).update(signedPayload).digest();
  
  try {
    const sigBuffer = Buffer.from(sig, 'base64');
    if (sigBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: 'Signature length mismatch' };
    }
    const isValid = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    return { valid: isValid, error: isValid ? undefined : 'Signature mismatch' };
  } catch {
    return { valid: false, error: 'Signature verification failed' };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const webhookId = req.headers['webhook-id'] as string | undefined;
  const webhookTimestamp = req.headers['webhook-timestamp'] as string | undefined;
  const webhookSignature = req.headers['webhook-signature'] as string | undefined;

  const secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  if (!secret) {
    Sentry.captureMessage('DODO_PAYMENTS_WEBHOOK_SECRET not set', { level: 'error' });
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return res.status(400).json({ error: 'Missing webhook headers' });
  }

  const signatureResult = verifySignature(rawBody, webhookId, webhookTimestamp, webhookSignature, secret);
  if (!signatureResult.valid) {
    addApiBreadcrumb('Dodo webhook signature verification failed', { error: signatureResult.error }, 'warning');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload: DodoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as DodoWebhookPayload;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (payload.type !== 'payment.succeeded') {
    return res.status(200).json({ received: true });
  }

  const userId = payload.data?.metadata?.user_id;
  const paymentId = payload.data?.payment_id;

  if (!userId) {
    addApiBreadcrumb('Dodo webhook: payment.succeeded without metadata.user_id', {}, 'warning');
    return res.status(200).json({ received: true });
  }

  addApiBreadcrumb('Dodo webhook: processing payment.succeeded', { userId, paymentId });

  const supabase = createServerSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('id, entitlement, dodo_payment_id')
    .eq('id', userId)
    .single();

  // Handle DB errors (not "not found") - return 500 to trigger webhook retry
  if (fetchError && fetchError.code !== 'PGRST116') {
    Sentry.captureException(new Error(`Dodo webhook DB query failed: ${fetchError.message}`), {
      tags: { component: 'webhooks.dodo' },
      extra: { userId, errorCode: fetchError.code },
    });
    return res.status(500).json({ error: 'Database error' });
  }

  if (!existing) {
    addApiBreadcrumb('Dodo webhook: user not found', { userId }, 'warning');
    return res.status(200).json({ received: true });
  }

  if (existing.entitlement === 'paid' && existing.dodo_payment_id) {
    return res.status(200).json({ received: true });
  }

  const { error } = await supabase
    .from('users')
    .update({
      entitlement: 'paid',
      dodo_payment_id: paymentId || null,
      paid_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    Sentry.captureException(new Error(`Dodo webhook update user failed: ${error.message}`), {
      tags: { component: 'webhooks.dodo' },
      extra: { userId, paymentId },
    });
    return res.status(500).json({ error: 'Update failed' });
  }

  invalidateEntitlementCache(userId);
  addApiBreadcrumb('Dodo webhook: user entitlement updated to paid', { userId, paymentId });

  return res.status(200).json({ received: true });
}
