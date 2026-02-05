/**
 * POST /api/checkout/create-session
 * Creates a Dodo Payments checkout session for the ₹199 one-time product.
 * Returns checkout_url for inline checkout SDK.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserId } from '../../../lib/apiAuth';
import { getEntitlement } from '../../../lib/entitlement';

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
  const productId = process.env.DODO_PAYMENTS_PRODUCT_ID;
  const returnUrl = process.env.DODO_PAYMENTS_RETURN_URL;

  if (!apiKey || !productId) {
    console.error('Dodo Payments: missing DODO_PAYMENTS_API_KEY or DODO_PAYMENTS_PRODUCT_ID');
    return res.status(500).json({ error: 'Checkout not configured' });
  }

  const entitlement = await getEntitlement(userId);
  if (entitlement === 'paid') {
    return res.status(400).json({ error: 'Already purchased' });
  }

  try {
    const body = {
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: returnUrl || undefined,
      metadata: { user_id: userId },
    };

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
      console.error('Dodo checkout create failed:', response.status, errText);
      return res.status(502).json({ error: 'Could not create checkout session' });
    }

    const data = (await response.json()) as { checkout_url?: string; checkout_session_id?: string };
    const checkoutUrl = data.checkout_url;
    const sessionId = data.checkout_session_id;

    if (!checkoutUrl) {
      return res.status(502).json({ error: 'No checkout URL in response' });
    }

    return res.status(200).json({ 
      checkout_url: checkoutUrl,
      session_id: sessionId,
    });
  } catch (error) {
    console.error('Checkout create-session error:', error);
    return res.status(500).json({ error: 'Checkout failed' });
  }
}
