import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { upsertUser, getUserByRedditId, type SupabaseUser } from './supabase';
import { redditClient, getIdentity, refreshAccessToken } from '../utils/reddit';
import { serialize } from 'cookie';

// Session expiry for admin tokens (7 days)
const ADMIN_SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check if a user is an admin based on their Reddit username.
 * Uses ADMIN_REDDIT_USERNAME environment variable.
 */
export const isAdmin = (redditUsername: string): boolean => {
  const adminUsername = process.env.ADMIN_REDDIT_USERNAME;
  if (!adminUsername) return false;
  return adminUsername.toLowerCase() === redditUsername.toLowerCase();
};

/**
 * Check if a password matches the admin password using constant-time comparison.
 * Uses ADMIN_PASSWORD environment variable.
 * Returns false if ADMIN_PASSWORD is not set.
 */
export const isAdminPassword = (password: string): boolean => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || !password) return false;
  
  // Hash both values so buffers are always the same length,
  // preventing timing side-channel leaking the password length.
  const adminHash = crypto.createHash('sha256').update(adminPassword).digest();
  const passwordHash = crypto.createHash('sha256').update(password).digest();
  
  return crypto.timingSafeEqual(adminHash, passwordHash);
};

/**
 * Create a signed admin session token.
 * Token format: timestamp:signature
 */
export const createAdminSessionToken = (timestamp: number): string => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not configured');
  }
  
  const data = `admin:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  
  return `${timestamp}:${signature}`;
};

/**
 * Verify an admin session token.
 * Returns true if signature is valid and token is not expired.
 */
export const verifyAdminSessionToken = (token: string): boolean => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || !token) return false;
  
  const parts = token.split(':');
  if (parts.length !== 2) return false;
  
  const [timestampStr, providedSignature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  
  if (!Number.isFinite(timestamp)) return false;
  
  // Check expiry
  const now = Date.now();
  if (now - timestamp > ADMIN_SESSION_EXPIRY_MS) return false;
  
  // Verify signature
  const data = `admin:${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  
  // Use constant-time comparison for signature
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);
  
  if (expectedBuffer.length !== providedBuffer.length) return false;
  
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

/**
 * Check if request has valid admin auth (either Reddit username or session token).
 * Checks in order:
 * 1. admin_session cookie (signed token)
 * 2. X-Admin-Password header (for direct API access)
 * 3. Reddit username (requires login)
 */
export const checkAdminAuth = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ isAdmin: boolean; method: 'password' | 'reddit' | null }> => {
  // Check session token from cookie (preferred secure method)
  const sessionCookie = req.cookies['admin_session'];
  if (sessionCookie && verifyAdminSessionToken(sessionCookie)) {
    return { isAdmin: true, method: 'password' };
  }

  // Check password from header (for direct API access)
  const passwordHeader = req.headers['x-admin-password'];
  if (typeof passwordHeader === 'string' && isAdminPassword(passwordHeader)) {
    return { isAdmin: true, method: 'password' };
  }

  // Fallback to Reddit username check
  const { redditUsername } = await getUserDetails(req, res);
  if (redditUsername && isAdmin(redditUsername)) {
    return { isAdmin: true, method: 'reddit' };
  }

  return { isAdmin: false, method: null };
};

/**
 * Get user details from request (including username for admin check).
 * Returns both user ID and full user object.
 */
export async function getUserDetails(req: NextApiRequest, res: NextApiResponse): Promise<{
  userId: string | null;
  user: SupabaseUser | null;
  redditUsername: string | null;
}> {
  const userId = await getUserId(req, res);
  if (!userId) {
    return { userId: null, user: null, redditUsername: null };
  }

  // Try to get username from cookie first (faster)
  const redditUsername = req.cookies['reddit_username'];
  if (redditUsername) {
    return { userId, user: null, redditUsername };
  }

  // Fallback: get from Reddit API
  const access = req.cookies['reddit_access'];
  if (access) {
    try {
      const client = redditClient(access);
      const redditUser = await getIdentity(client);
      return { userId, user: null, redditUsername: redditUser.name };
    } catch {
      // Ignore errors, return without username
    }
  }

  return { userId, user: null, redditUsername: null };
}

/**
 * Get or create user ID from request.
 * First tries the supabase_user_id cookie.
 * Falls back to fetching from Reddit and syncing to Supabase.
 * Sets the cookie for future requests if missing.
 */
export async function getUserId(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  // First try the cookie
  let userId = req.cookies['supabase_user_id'];
  if (userId) return userId;
  
  // Fallback: try to get user from Reddit token and sync to Supabase
  const access = req.cookies['reddit_access'];
  const refresh = req.cookies['reddit_refresh'];
  
  if (!access && !refresh) return null;
  
  try {
    let token = access;
    
    // Try to refresh if no access token
    if (!token && refresh) {
      const t = await refreshAccessToken(refresh);
      token = t.access_token;
      // Set the new access token cookie
      res.setHeader('Set-Cookie', serialize('reddit_access', token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: t.expires_in - 10,
      }));
    }
    
    if (!token) return null;
    
    const client = redditClient(token);
    const redditUser = await getIdentity(client);
    
    // Sync to Supabase and get user ID
    const supabaseUser = await upsertUser({
      reddit_id: redditUser.id,
      reddit_username: redditUser.name,
      reddit_avatar_url: redditUser.icon_img,
    });
    
    userId = supabaseUser.id;
    
    // Set the cookie for future requests
    res.appendHeader('Set-Cookie', serialize('supabase_user_id', userId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    }));
    
    return userId;
  } catch (error) {
    console.error('Failed to get user ID from Reddit token:', error);
    return null;
  }
}
