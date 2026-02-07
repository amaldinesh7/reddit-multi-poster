/**
 * POST /api/checkout/create-session
 * Creates a Dodo Payments checkout session for a one-time lifetime product.
 * Region routing:
 * - India: INR product (exact ₹299)
 * - US/Canada + Rest of world: USD product ($9)
 * Returns checkout_url for inline checkout SDK.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { getUserId } from '../../../lib/apiAuth';
import { getEntitlement } from '../../../lib/entitlement';
import { addApiBreadcrumb } from '../../../lib/apiErrorHandler';
import { trackServerEvent } from '../../../lib/posthog-server';
import { getPricingForRequest, getPricingRegionForCountry, getCountryCodeFromRequest } from '@/lib/pricing';
import { getPricingAmountsFromEnv } from '@/lib/pricingConfig';

const DODO_BASE_URL =
  process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode'
    ? 'https://live.dodopayments.com'
    : 'https://test.dodopayments.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserId(req, res);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const returnUrl = process.env.DODO_PAYMENTS_RETURN_URL;
  const inrProductId = process.env.DODO_PAYMENTS_PRODUCT_ID_INR;
  const usdProductId = process.env.DODO_PAYMENTS_PRODUCT_ID_USD;

  if (!apiKey || !inrProductId || !usdProductId) {
    Sentry.captureMessage('Missing DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_PRODUCT_ID_INR, or DODO_PAYMENTS_PRODUCT_ID_USD', {
      level: 'error',
    });
    return res.status(500).json({ error: 'Checkout not configured' });
  }

  const entitlement = await getEntitlement(userId);
  if (entitlement === 'paid') {
    return res.status(400).json({ error: 'Already purchased' });
  }

  try {
    const countryCode = getCountryCodeFromRequest(req);
    const region = getPricingRegionForCountry(countryCode);
    const pricing = getPricingForRequest(req, getPricingAmountsFromEnv());

    const productId = region === 'india' ? inrProductId : usdProductId;

    const body = {
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: returnUrl || undefined,
      metadata: { user_id: userId },
    };

    console.log('[Dodo Debug] Creating checkout session:', {
      url: `${DODO_BASE_URL}/checkouts`,
      productId,
      region,
      countryCode,
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT,
      hasApiKey: !!apiKey,
    });

    const response = await fetch(`${DODO_BASE_URL}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Dodo Debug] Checkout creation failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errText,
      });
      Sentry.captureException(new Error(`Dodo checkout create failed: ${response.status}`), {
        tags: { component: 'checkout.create-session' },
        extra: { hasUserId: true, status: response.status, responseBody: errText },
      });
      return res.status(502).json({ error: 'Could not create checkout session', details: errText });
    }

    const data = (await response.json()) as { checkout_url?: string; session_id?: string };
    const checkoutUrl = data.checkout_url;
    const sessionId = data.session_id;

    if (!checkoutUrl) {
      addApiBreadcrumb('Dodo checkout: no checkout URL in response', {}, 'warning');
      return res.status(502).json({ error: 'No checkout URL in response' });
    }

    if (!sessionId) {
      addApiBreadcrumb('Dodo checkout: no session ID in response', {}, 'warning');
    }

    addApiBreadcrumb('Checkout session created', {});
    
    // Track checkout started for funnel analytics
    trackServerEvent(userId, 'checkout_started', {
      plan: 'pro',
      amount: pricing.amount,
      currency: pricing.currency,
      pricing_region: pricing.region,
    });
    
    return res.status(200).json({ 
      checkout_url: checkoutUrl,
      session_id: sessionId,
      pricing,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'checkout.create-session' },
      extra: { hasUserId: true },
    });
    return res.status(500).json({ error: 'Checkout failed' });
  }
}
