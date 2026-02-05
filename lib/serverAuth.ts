import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next';

interface AuthCheckResult {
  authenticated: boolean;
  cookies: {
    access?: string;
    refresh?: string;
    supabaseUserId?: string;
  };
}

/**
 * Check if auth cookies exist (server-side).
 * This is a fast check that doesn't validate the token - just checks for presence.
 * Token validation still happens client-side via /api/me.
 */
export function checkAuthCookies(
  context: GetServerSidePropsContext
): AuthCheckResult {
  const { reddit_access, reddit_refresh, supabase_user_id } = context.req.cookies;
  
  const hasAuthCookies = !!(reddit_access || reddit_refresh);
  
  return {
    authenticated: hasAuthCookies,
    cookies: {
      access: reddit_access,
      refresh: reddit_refresh,
      supabaseUserId: supabase_user_id,
    },
  };
}

/**
 * Helper to create a redirect response for getServerSideProps
 */
export function redirectToLogin(): GetServerSidePropsResult<Record<string, never>> {
  return {
    redirect: {
      destination: '/login',
      permanent: false,
    },
  };
}
