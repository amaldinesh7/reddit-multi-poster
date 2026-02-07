import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { notifyNewUserSignup, NewUserData } from '@/lib/notifications';

/**
 * Supabase Database Webhook handler for new user signups.
 *
 * Setup in Supabase Dashboard:
 * 1. Go to Database → Webhooks → Create a new webhook
 * 2. Name: new_user_signup_alert
 * 3. Table: users
 * 4. Events: INSERT
 * 5. Type: HTTP Request
 * 6. Method: POST
 * 7. URL: https://your-domain.com/api/webhooks/new-user
 * 8. Headers: Add "x-webhook-secret" with your SUPABASE_WEBHOOK_SECRET value
 */

interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: {
    id: string;
    reddit_id: string;
    reddit_username: string;
    reddit_avatar_url: string | null;
    created_at: string;
    updated_at: string;
    entitlement: string;
    dodo_payment_id: string | null;
    paid_at: string | null;
  } | null;
  old_record: Record<string, unknown> | null;
}

/**
 * Verify the webhook request is from Supabase.
 * Uses a shared secret in the x-webhook-secret header.
 */
const verifyWebhookSignature = (req: NextApiRequest): boolean => {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('SUPABASE_WEBHOOK_SECRET not configured');
    return false;
  }

  const providedSecret = req.headers['x-webhook-secret'];

  if (!providedSecret || typeof providedSecret !== 'string') {
    console.error('Missing x-webhook-secret header');
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(secret),
      Buffer.from(providedSecret)
    );
  } catch {
    return false;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the webhook signature
  if (!verifyWebhookSignature(req)) {
    console.error('Webhook signature verification failed');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = req.body as SupabaseWebhookPayload;

    // Validate payload structure
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Only process INSERT events on the users table
    if (payload.type !== 'INSERT' || payload.table !== 'users') {
      return res.status(200).json({ message: 'Event ignored' });
    }

    // Validate record exists
    if (!payload.record) {
      return res.status(400).json({ error: 'Missing record in payload' });
    }

    const { id, reddit_username, reddit_avatar_url, created_at } = payload.record;

    console.log(`New user signup webhook received: u/${reddit_username}`);

    // Prepare user data for notifications
    const userData: NewUserData = {
      id,
      reddit_username,
      reddit_avatar_url,
      created_at,
    };

    // Send notifications (non-blocking)
    await notifyNewUserSignup(userData);

    console.log(`Notifications sent for new user: u/${reddit_username}`);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing new user webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
