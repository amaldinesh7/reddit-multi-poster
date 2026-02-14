/**
 * POST /api/webhooks/dodo
 * Dodo Payments webhook: payment.succeeded → set user entitlement to paid.
 * Uses Standard Webhooks library for signature verification.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { Webhook } from 'standardwebhooks';
import { createServerSupabaseClient } from '../../../lib/supabase';
import { invalidateEntitlementCache } from '../../../lib/entitlement';
import { addApiBreadcrumb } from '../../../lib/apiErrorHandler';
import { trackServerEvent } from '../../../lib/posthog-server';
import { getPricingRegionForCountry } from '@/lib/pricing';

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
    let data = '';
    req.on('data', (chunk: string | Buffer) => {
      data += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Dodo Webhook Debug] Received webhook request');

  const rawBody = await getRawBody(req);
  const webhookId = req.headers['webhook-id'] as string | undefined;
  const webhookTimestamp = req.headers['webhook-timestamp'] as string | undefined;
  const webhookSignature = req.headers['webhook-signature'] as string | undefined;

  console.log('[Dodo Webhook Debug] Headers:', {
    webhookId: webhookId ? 'present' : 'missing',
    webhookTimestamp: webhookTimestamp ? 'present' : 'missing',
    webhookSignature: webhookSignature ? `present (${webhookSignature?.substring(0, 20)}...)` : 'missing',
  });

  const secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Dodo Webhook Debug] DODO_PAYMENTS_WEBHOOK_SECRET not set');
    Sentry.captureMessage('DODO_PAYMENTS_WEBHOOK_SECRET not set', { level: 'error' });
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    console.error('[Dodo Webhook Debug] Missing required headers');
    return res.status(400).json({ error: 'Missing webhook headers' });
  }

  // Use standardwebhooks library for proper signature verification
  // The library handles whsec_ prefix stripping and base64 decoding automatically
  const wh = new Webhook(secret);
  let payload: DodoWebhookPayload;
  
  try {
    payload = wh.verify(rawBody, {
      'webhook-id': webhookId,
      'webhook-signature': webhookSignature,
      'webhook-timestamp': webhookTimestamp,
    }) as DodoWebhookPayload;
    console.log('[Dodo Webhook Debug] Signature verified successfully');
  } catch (verifyError) {
    const errorMessage = verifyError instanceof Error ? verifyError.message : 'Unknown verification error';
    console.error('[Dodo Webhook Debug] Signature verification failed:', errorMessage);
    addApiBreadcrumb('Dodo webhook signature verification failed', { error: errorMessage }, 'warning');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Payload is already parsed and verified by the standardwebhooks library
  console.log('[Dodo Webhook Debug] Payload parsed:', {
    type: payload.type,
    hasData: !!payload.data,
    metadata: payload.data?.metadata,
  });

  if (payload.type !== 'payment.succeeded') {
    console.log('[Dodo Webhook Debug] Ignoring event type:', payload.type);
    return res.status(200).json({ received: true });
  }

  const userId = payload.data?.metadata?.user_id;
  const paymentId = payload.data?.payment_id;
  const pricingRegion = getPricingRegionForCountry(payload.data?.metadata?.country_code ?? null);

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
  
  // Track checkout completion for funnel analytics
  trackServerEvent(userId, 'checkout_completed', {
    plan: 'pro',
    // Webhook doesn't currently include amount/currency reliably; keep as metadata-only.
    pricing_region: pricingRegion,
  });

  if (existing.entitlement === 'trial') {
    trackServerEvent(userId, 'trial_converted_to_paid', {
      plan: 'pro',
      pricing_region: pricingRegion,
    });
  }

  return res.status(200).json({ received: true });
}
