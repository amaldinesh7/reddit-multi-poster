/**
 * POST /api/webhooks/dodo
 * Dodo Payments webhook: payment.succeeded → set user entitlement to paid.
 * Uses Standard Webhooks: verify webhook-signature (HMAC SHA256 of webhook-id.timestamp.body).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { createServerSupabaseClient } from '../../../lib/supabase';
import { invalidateEntitlementCache } from '../../../lib/entitlement';

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

function verifySignature(
  rawBody: string,
  webhookId: string,
  webhookTimestamp: string,
  webhookSignature: string,
  secret: string
): boolean {
  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const sig = webhookSignature.includes(',') ? webhookSignature.split(',').pop()?.trim() ?? webhookSignature : webhookSignature;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
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
    console.error('Dodo webhook: DODO_PAYMENTS_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return res.status(400).json({ error: 'Missing webhook headers' });
  }

  if (!verifySignature(rawBody, webhookId, webhookTimestamp, webhookSignature, secret)) {
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
    console.warn('Dodo webhook: payment.succeeded without metadata.user_id');
    return res.status(200).json({ received: true });
  }

  const supabase = createServerSupabaseClient();

  const { data: existing } = await supabase
    .from('users')
    .select('id, entitlement, dodo_payment_id')
    .eq('id', userId)
    .single();

  if (!existing) {
    console.warn('Dodo webhook: user not found', userId);
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
    console.error('Dodo webhook: update user failed', error);
    return res.status(500).json({ error: 'Update failed' });
  }

  invalidateEntitlementCache(userId);

  return res.status(200).json({ received: true });
}
