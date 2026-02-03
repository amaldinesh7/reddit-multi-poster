import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Keep-alive endpoint to prevent Supabase from pausing after inactivity.
 * This endpoint performs a lightweight query to keep the database active.
 * 
 * Configured to run via Vercel Cron Jobs (see vercel.json).
 * Schedule: Every 6 hours (cron: 0 0,6,12,18 * * *) to ensure Supabase stays active.
 * 
 * Security: 
 * - Vercel cron jobs are automatically authenticated via x-vercel-cron header
 * - Optional KEEP_ALIVE_SECRET for additional security if needed
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify request is from Vercel Cron (automatically set by Vercel)
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  // If not from Vercel cron, check for optional secret token
  if (!isVercelCron) {
    const keepAliveSecret = process.env.KEEP_ALIVE_SECRET;
    if (keepAliveSecret) {
      const providedSecret = req.query.secret || req.headers['x-keep-alive-secret'];
      if (providedSecret !== keepAliveSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    // If no secret is configured and not from Vercel, allow for testing
    // In production, you should set KEEP_ALIVE_SECRET
  }

  try {
    const supabase = createServerSupabaseClient();
    
    // Perform a lightweight query to keep the database active
    // This query is minimal and fast - just checks if we can connect
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine for keep-alive
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: 'Supabase keep-alive successful',
      timestamp: new Date().toISOString(),
      database: 'active',
    });
  } catch (error) {
    console.error('Keep-alive error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to ping Supabase',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
