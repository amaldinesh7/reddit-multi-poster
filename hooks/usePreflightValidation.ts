/**
 * usePreflightValidation Hook
 * 
 * Provides reactive pre-flight validation for post submissions.
 * Validates title, body, flairs, URLs, and subreddit requirements.
 */

import { useMemo, useCallback } from 'react';
import {
  PreflightInput,
  PreflightResult,
  ValidationIssue,
  validatePreflight,
  groupIssuesBySubreddit,
  formatIssuesSummary,
} from '@/lib/preflightValidation';

// ============================================================================
// Types
// ============================================================================

export interface UsePreflightValidationInput {
  title: string;
  body?: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  url?: string;
  subreddits: string[];
  flairValue: Record<string, string | undefined>;
  flairRequired: Record<string, boolean>;
  flairOptions: Record<string, { id: string; text: string }[]>;
  postRequirements: Record<string, import('@/utils/reddit').PostRequirements>;
  titleSuffixes?: Record<string, string | undefined>;
  /** User data for eligibility checks */
  userData?: import('@/utils/reddit').RedditUser;
  /** Eligibility data by subreddit */
  eligibilityData?: Record<string, import('@/utils/reddit').SubredditEligibility>;
}

export interface UsePreflightValidationReturn {
  /** Full validation result */
  result: PreflightResult;
  /** Whether the form can be submitted */
  canSubmit: boolean;
  /** All validation issues */
  issues: ValidationIssue[];
  /** Issues grouped by subreddit */
  issuesBySubreddit: Record<string, ValidationIssue[]>;
  /** Summary text for display */
  summary: string;
  /** Blocking errors only */
  errors: ValidationIssue[];
  /** Warnings only */
  warnings: ValidationIssue[];
  /** Get issues for a specific subreddit */
  getIssuesForSubreddit: (subreddit: string) => ValidationIssue[];
  /** Check if a specific subreddit has errors */
  hasErrorsForSubreddit: (subreddit: string) => boolean;
  /** Check if a specific subreddit has warnings */
  hasWarningsForSubreddit: (subreddit: string) => boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePreflightValidation(input: UsePreflightValidationInput): UsePreflightValidationReturn {
  // Memoize the validation result
  const result = useMemo(() => {
    const preflightInput: PreflightInput = {
      title: input.title,
      body: input.body,
      kind: input.kind,
      url: input.url,
      subreddits: input.subreddits,
      flairValue: input.flairValue,
      flairRequired: input.flairRequired,
      flairOptions: input.flairOptions,
      postRequirements: input.postRequirements,
      titleSuffixes: input.titleSuffixes,
      userData: input.userData,
      eligibilityData: input.eligibilityData,
    };

    return validatePreflight(preflightInput);
  }, [
    input.title,
    input.body,
    input.kind,
    input.url,
    input.subreddits,
    input.flairValue,
    input.flairRequired,
    input.flairOptions,
    input.postRequirements,
    input.titleSuffixes,
    input.userData,
    input.eligibilityData,
  ]);

  // Group issues by subreddit
  const issuesBySubreddit = useMemo(() => 
    groupIssuesBySubreddit(result.issues),
    [result.issues]
  );

  // Summary text
  const summary = useMemo(() => 
    formatIssuesSummary(result),
    [result]
  );

  // Filter by severity
  const errors = useMemo(() => 
    result.issues.filter(i => i.severity === 'error'),
    [result.issues]
  );

  const warnings = useMemo(() => 
    result.issues.filter(i => i.severity === 'warning'),
    [result.issues]
  );

  // Helper functions
  const getIssuesForSubreddit = useCallback((subreddit: string): ValidationIssue[] => {
    return issuesBySubreddit[subreddit] || [];
  }, [issuesBySubreddit]);

  const hasErrorsForSubreddit = useCallback((subreddit: string): boolean => {
    const issues = issuesBySubreddit[subreddit] || [];
    return issues.some(i => i.severity === 'error');
  }, [issuesBySubreddit]);

  const hasWarningsForSubreddit = useCallback((subreddit: string): boolean => {
    const issues = issuesBySubreddit[subreddit] || [];
    return issues.some(i => i.severity === 'warning');
  }, [issuesBySubreddit]);

  return {
    result,
    canSubmit: result.canProceed,
    issues: result.issues,
    issuesBySubreddit,
    summary,
    errors,
    warnings,
    getIssuesForSubreddit,
    hasErrorsForSubreddit,
    hasWarningsForSubreddit,
  };
}

export type { ValidationIssue, PreflightResult };
