import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserId } from '../../../lib/apiAuth';
import { createServerSupabaseClient } from '../../../lib/supabase';
import { invalidateEntitlementCache } from '../../../lib/entitlement';
import { trackServerEvent } from '../../../lib/posthog-server';

const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

interface TrialUserRow {
  entitlement: string;
  trial_used_at: string | null;
  trial_ends_at: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserId(req, res);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createServerSupabaseClient();
  const { data: currentUser, error: userError } = await supabase
    .from('users')
    .select('entitlement, trial_used_at, trial_ends_at')
    .eq('id', userId)
    .single<TrialUserRow>();

  if (userError || !currentUser) {
    return res.status(500).json({ error: 'Could not load user state' });
  }

  if (currentUser.entitlement === 'paid') {
    return res.status(400).json({ error: 'You already have lifetime Pro.' });
  }

  const now = Date.now();
  const activeTrialEndsAt = currentUser.trial_ends_at ? new Date(currentUser.trial_ends_at).getTime() : 0;
  if (currentUser.entitlement === 'trial' && Number.isFinite(activeTrialEndsAt) && activeTrialEndsAt > now) {
    const daysLeft = Math.max(1, Math.ceil((activeTrialEndsAt - now) / DAY_MS));
    return res.status(200).json({
      started: false,
      entitlement: 'trial',
      trialEndsAt: currentUser.trial_ends_at,
      trialDaysLeft: daysLeft,
    });
  }

  if (currentUser.trial_used_at) {
    return res.status(400).json({ error: 'Your 7-day Pro trial has already been used.' });
  }

  const trialStartedAt = new Date(now).toISOString();
  const trialEndsAt = new Date(now + TRIAL_DAYS * DAY_MS).toISOString();

  const { error: updateError } = await supabase
    .from('users')
    .update({
      entitlement: 'trial',
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
      trial_used_at: trialStartedAt,
      trial_ended_notified_at: null,
    })
    .eq('id', userId)
    .is('trial_used_at', null)
    .neq('entitlement', 'paid');

  if (updateError) {
    return res.status(500).json({ error: 'Failed to start trial' });
  }

  invalidateEntitlementCache(userId);
  trackServerEvent(userId, 'trial_started', { plan: 'pro_trial' });

  return res.status(200).json({
    started: true,
    entitlement: 'trial',
    trialEndsAt,
    trialDaysLeft: TRIAL_DAYS,
  });
}
