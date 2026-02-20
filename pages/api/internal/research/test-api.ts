import type { NextApiRequest, NextApiResponse } from 'next';
import { assertInternalResearchApiEnabled } from '@/lib/internal/research/guard';
import { getResearchAccessToken } from '@/lib/internal/research/auth';
import { redditClient } from '@/utils/reddit';

/**
 * GET /api/internal/research/test-api
 *
 * Quick diagnostic that verifies the current Reddit OAuth token works for
 * the endpoints the research scanner relies on:
 *   1. /api/v1/me          — requires `identity` scope
 *   2. /r/{sub}/new        — requires `read` scope
 *   3. /user/{me}/submitted — requires `history` scope (the one that was missing)
 *
 * Returns raw HTTP status + a snippet for each call so the user can confirm
 * their token and scopes are correct before running a full scan.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (!assertInternalResearchApiEnabled(res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = await getResearchAccessToken(req, res);
  if (!token) {
    res.status(401).json({
      error: 'No Reddit OAuth token — please log in first',
      tests: [],
    });
    return;
  }

  const client = redditClient(token);

  interface TestResult {
    endpoint: string;
    scope: string;
    status: number;
    ok: boolean;
    detail: string;
  }

  const results: TestResult[] = [];

  // Test 1: /api/v1/me (identity scope)
  try {
    const resp = await client.get('/api/v1/me', { params: { raw_json: 1 } });
    const username = resp.data?.name ?? '(unknown)';
    results.push({
      endpoint: '/api/v1/me',
      scope: 'identity',
      status: resp.status,
      ok: true,
      detail: `Authenticated as u/${username}`,
    });
  } catch (error: unknown) {
    const axErr = error as { response?: { status?: number; data?: unknown } };
    const status = axErr?.response?.status ?? 0;
    results.push({
      endpoint: '/api/v1/me',
      scope: 'identity',
      status,
      ok: false,
      detail: status === 401
        ? 'Token expired or invalid — re-authenticate'
        : `HTTP ${status}: ${error instanceof Error ? error.message : 'unknown'}`,
    });
  }

  // Use authenticated username for the history test (test own submissions)
  const meUsername = results[0]?.ok
    ? results[0].detail.replace('Authenticated as u/', '')
    : null;

  // Test 2: /r/all/new (read scope)
  try {
    const resp = await client.get('/r/all/new', {
      params: { limit: 1, raw_json: 1 },
    });
    const postCount = resp.data?.data?.children?.length ?? 0;
    results.push({
      endpoint: '/r/all/new',
      scope: 'read',
      status: resp.status,
      ok: true,
      detail: `Returned ${postCount} post(s)`,
    });
  } catch (error: unknown) {
    const axErr = error as { response?: { status?: number } };
    const status = axErr?.response?.status ?? 0;
    results.push({
      endpoint: '/r/all/new',
      scope: 'read',
      status,
      ok: false,
      detail: status === 403
        ? 'Missing "read" OAuth scope'
        : `HTTP ${status}: ${error instanceof Error ? error.message : 'unknown'}`,
    });
  }

  // Test 3: /user/{username}/submitted (history scope — the critical one)
  const historyTarget = meUsername ?? 'spez'; // fallback to Reddit CEO's public profile
  try {
    const resp = await client.get(`/user/${historyTarget}/submitted`, {
      params: { limit: 1, sort: 'new', raw_json: 1 },
    });
    const postCount = resp.data?.data?.children?.length ?? 0;
    results.push({
      endpoint: `/user/${historyTarget}/submitted`,
      scope: 'history',
      status: resp.status,
      ok: true,
      detail: `Returned ${postCount} submission(s) for u/${historyTarget}`,
    });
  } catch (error: unknown) {
    const axErr = error as { response?: { status?: number } };
    const status = axErr?.response?.status ?? 0;
    results.push({
      endpoint: `/user/${historyTarget}/submitted`,
      scope: 'history',
      status,
      ok: false,
      detail: status === 403
        ? 'Missing "history" OAuth scope — you MUST re-authenticate with Reddit to get the new scope'
        : `HTTP ${status}: ${error instanceof Error ? error.message : 'unknown'}`,
    });
  }

  const allPassed = results.every((r) => r.ok);

  res.status(200).json({
    allPassed,
    message: allPassed
      ? 'All API tests passed — token and scopes are correct'
      : 'Some tests failed — see details below. You may need to log out and re-authenticate with Reddit.',
    tests: results,
  });
}
