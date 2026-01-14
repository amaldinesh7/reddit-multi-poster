import type { NextApiRequest, NextApiResponse } from 'next';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

// In-memory store (for single server deployment)
// For production with multiple servers, use Redis
const store: RateLimitStore = {};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const key of Object.keys(store)) {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  }
}, 60000); // Clean every minute

interface RateLimitConfig {
  limit: number;        // Max requests
  windowMs: number;     // Time window in milliseconds
  keyGenerator?: (req: NextApiRequest) => string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(config: RateLimitConfig) {
  const { limit, windowMs, keyGenerator } = config;

  return function checkRateLimit(req: NextApiRequest): RateLimitResult {
    const now = Date.now();
    
    // Generate key based on IP or custom generator
    const key = keyGenerator 
      ? keyGenerator(req) 
      : getClientIp(req) || 'anonymous';
    
    // Get or create entry
    if (!store[key] || store[key].resetAt < now) {
      store[key] = {
        count: 0,
        resetAt: now + windowMs,
      };
    }
    
    const entry = store[key];
    entry.count++;
    
    const remaining = Math.max(0, limit - entry.count);
    const success = entry.count <= limit;
    
    return {
      success,
      remaining,
      resetAt: entry.resetAt,
    };
  };
}

// Extract client IP from various headers
function getClientIp(req: NextApiRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  
  return req.socket?.remoteAddress || null;
}

// Pre-configured rate limiters
export const postingRateLimit = rateLimit({
  limit: 10,
  windowMs: 60 * 1000, // 10 requests per minute
});

export const settingsRateLimit = rateLimit({
  limit: 60,
  windowMs: 60 * 1000, // 60 requests per minute
});

export const cacheRateLimit = rateLimit({
  limit: 100,
  windowMs: 60 * 1000, // 100 requests per minute
});

// Helper to apply rate limit and respond
export function applyRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  limiter: ReturnType<typeof rateLimit>
): boolean {
  const result = limiter(req);
  
  res.setHeader('X-RateLimit-Limit', result.remaining + (result.success ? 1 : 0));
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
  
  if (!result.success) {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      },
    });
    return false;
  }
  
  return true;
}
