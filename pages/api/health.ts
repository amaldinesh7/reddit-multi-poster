import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Health check endpoint for Render and monitoring services.
 * 
 * Use cases:
 * - Render health checks (prevents spin-down)
 * - UptimeRobot / Better Uptime monitoring
 * - Load balancer health checks
 * 
 * Query params:
 * - ?deep=true - Also checks Supabase connection (slower but more thorough)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const deepCheck = req.query.deep === 'true';

  try {
    const response: {
      status: 'healthy' | 'degraded';
      timestamp: string;
      uptime: number;
      version: string;
      checks: {
        app: 'ok';
        database?: 'ok' | 'error';
      };
      latency?: number;
    } = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        app: 'ok',
      },
    };

    // Deep check includes Supabase ping
    if (deepCheck) {
      try {
        const supabase = createServerSupabaseClient();
        const { error } = await supabase
          .from('users')
          .select('id')
          .limit(1);

        if (error && error.code !== 'PGRST116') {
          response.checks.database = 'error';
          response.status = 'degraded';
        } else {
          response.checks.database = 'ok';
        }
      } catch {
        response.checks.database = 'error';
        response.status = 'degraded';
      }
    }

    response.latency = Date.now() - startTime;

    // Return 200 even if degraded - Render will keep the service alive
    // Only return 503 for complete failure
    return res.status(200).json(response);
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - startTime,
    });
  }
}
