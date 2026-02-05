/**
 * Pre-flight Validation
 * 
 * Validates post parameters before submission to catch errors early.
 * Provides detailed warnings and errors with suggested fixes.
 */

import { PostRequirements } from '../utils/reddit';
import { ErrorCategory } from './errorClassification';

// ============================================================================
// Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  /** Unique identifier for the issue type */
  code: string;
  /** Severity level */
  severity: ValidationSeverity;
  /** Subreddit this issue applies to (if specific) */
  subreddit?: string;
  /** Human-readable message */
  message: string;
  /** Suggested action to fix */
  suggestion?: string;
  /** Which field has the issue */
  field?: 'title' | 'body' | 'flair' | 'media' | 'url';
  /** Expected error category if this proceeds to posting */
  expectedCategory?: ErrorCategory;
}

export interface PreflightResult {
  /** Whether posting can proceed */
  canProceed: boolean;
  /** List of issues found */
  issues: ValidationIssue[];
  /** Count by severity */
  counts: {
    errors: number;
    warnings: number;
    info: number;
  };
  /** Quick access to blocking errors */
  blockingErrors: ValidationIssue[];
}

export interface PreflightInput {
  /** Post title */
  title: string;
  /** Post body/description (for self posts) */
  body?: string;
  /** Post type */
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  /** URL (for link posts) */
  url?: string;
  /** Selected subreddits */
  subreddits: string[];
  /** Selected flairs by subreddit */
  flairValue: Record<string, string | undefined>;
  /** Whether flairs are required by subreddit */
  flairRequired: Record<string, boolean>;
  /** Available flair options by subreddit */
  flairOptions: Record<string, { id: string; text: string }[]>;
  /** Post requirements by subreddit */
  postRequirements: Record<string, PostRequirements>;
  /** Title suffixes by subreddit */
  titleSuffixes?: Record<string, string | undefined>;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates that required flairs are selected
 */
function validateFlairs(input: PreflightInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const subreddit of input.subreddits) {
    const isRequired = input.flairRequired[subreddit];
    const hasSelected = !!input.flairValue[subreddit];
    const hasOptions = (input.flairOptions[subreddit] || []).length > 0;

    if (isRequired && !hasSelected) {
      if (hasOptions) {
        issues.push({
          code: 'FLAIR_REQUIRED',
          severity: 'error',
          subreddit,
          message: `r/${subreddit} requires a flair`,
          suggestion: 'Select a flair from the dropdown',
          field: 'flair',
          expectedCategory: 'fixable_now',
        });
      } else {
        issues.push({
          code: 'FLAIR_REQUIRED_NO_OPTIONS',
          severity: 'warning',
          subreddit,
          message: `r/${subreddit} requires a flair but none are available`,
          suggestion: 'Try refreshing flairs or check if the subreddit allows your post type',
          field: 'flair',
          expectedCategory: 'fixable_later',
        });
      }
    }
  }

  return issues;
}

/**
 * Validates title against subreddit requirements
 */
function validateTitle(input: PreflightInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const baseTitle = input.title;

  if (!baseTitle || baseTitle.trim().length === 0) {
    issues.push({
      code: 'TITLE_EMPTY',
      severity: 'error',
      message: 'Title is required',
      suggestion: 'Enter a title for your post',
      field: 'title',
      expectedCategory: 'fixable_now',
    });
    return issues;
  }

  // Check Reddit's global title limits
  if (baseTitle.length > 300) {
    issues.push({
      code: 'TITLE_TOO_LONG_GLOBAL',
      severity: 'error',
      message: `Title is ${baseTitle.length} characters (max 300)`,
      suggestion: 'Shorten your title',
      field: 'title',
      expectedCategory: 'fixable_now',
    });
  }

  // Check per-subreddit title requirements
  for (const subreddit of input.subreddits) {
    const reqs = input.postRequirements[subreddit];
    if (!reqs) continue;

    const suffix = input.titleSuffixes?.[subreddit] || '';
    const fullTitle = `${baseTitle}${suffix}`;

    // Min length
    if (reqs.title_text_min_length && fullTitle.length < reqs.title_text_min_length) {
      issues.push({
        code: 'TITLE_TOO_SHORT',
        severity: 'error',
        subreddit,
        message: `r/${subreddit}: Title must be at least ${reqs.title_text_min_length} characters (currently ${fullTitle.length})`,
        suggestion: 'Make your title longer or add a title suffix',
        field: 'title',
        expectedCategory: 'fixable_now',
      });
    }

    // Max length
    if (reqs.title_text_max_length && fullTitle.length > reqs.title_text_max_length) {
      issues.push({
        code: 'TITLE_TOO_LONG',
        severity: 'error',
        subreddit,
        message: `r/${subreddit}: Title must be at most ${reqs.title_text_max_length} characters (currently ${fullTitle.length})`,
        suggestion: 'Shorten your title or remove the title suffix',
        field: 'title',
        expectedCategory: 'fixable_now',
      });
    }

    // Title regex patterns
    if (reqs.title_regexes && reqs.title_regexes.length > 0) {
      const matchesAny = reqs.title_regexes.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(fullTitle);
        } catch {
          return false; // Invalid regex, skip
        }
      });

      if (!matchesAny) {
        issues.push({
          code: 'TITLE_PATTERN_MISMATCH',
          severity: 'warning',
          subreddit,
          message: `r/${subreddit}: Title may not match required format`,
          suggestion: 'Check the subreddit rules for title requirements',
          field: 'title',
          expectedCategory: 'fixable_now',
        });
      }
    }
  }

  return issues;
}

/**
 * Validates body/description against subreddit requirements
 */
function validateBody(input: PreflightInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const body = input.body || '';

  for (const subreddit of input.subreddits) {
    const reqs = input.postRequirements[subreddit];
    if (!reqs) continue;

    // Body required check
    if (reqs.body_restriction_policy === 'required' && !body.trim()) {
      issues.push({
        code: 'BODY_REQUIRED',
        severity: 'error',
        subreddit,
        message: `r/${subreddit} requires a description`,
        suggestion: 'Add a description to your post',
        field: 'body',
        expectedCategory: 'fixable_now',
      });
      continue;
    }

    // Min length (only if body exists)
    if (body && reqs.body_text_min_length && body.length < reqs.body_text_min_length) {
      issues.push({
        code: 'BODY_TOO_SHORT',
        severity: 'error',
        subreddit,
        message: `r/${subreddit}: Description must be at least ${reqs.body_text_min_length} characters (currently ${body.length})`,
        suggestion: 'Add more content to your description',
        field: 'body',
        expectedCategory: 'fixable_now',
      });
    }

    // Max length
    if (body && reqs.body_text_max_length && body.length > reqs.body_text_max_length) {
      issues.push({
        code: 'BODY_TOO_LONG',
        severity: 'error',
        subreddit,
        message: `r/${subreddit}: Description must be at most ${reqs.body_text_max_length} characters (currently ${body.length})`,
        suggestion: 'Shorten your description',
        field: 'body',
        expectedCategory: 'fixable_now',
      });
    }

    // Body regex patterns (only check if body exists)
    if (body && reqs.body_regexes && reqs.body_regexes.length > 0) {
      const matchesAny = reqs.body_regexes.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(body);
        } catch {
          return false; // Invalid regex, skip
        }
      });

      if (!matchesAny) {
        issues.push({
          code: 'BODY_PATTERN_MISMATCH',
          severity: 'warning',
          subreddit,
          message: `r/${subreddit}: Description may not match required format`,
          suggestion: 'Check the subreddit rules for description requirements',
          field: 'body',
          expectedCategory: 'fixable_now',
        });
      }
    }
  }

  return issues;
}

/**
 * Helper to find blacklisted words in text (case-insensitive)
 */
function findBlacklistedWords(text: string, blacklist: string[]): string[] {
  const lowerText = text.toLowerCase();
  return blacklist.filter(word => {
    const lowerWord = word.toLowerCase();
    // Use word boundary matching to avoid partial matches
    // e.g., "teen" should not match "canteen"
    const regex = new RegExp(`\\b${lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(lowerText);
  });
}

/**
 * Validates title and body against blacklisted strings
 */
function validateBlacklistedStrings(input: PreflightInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const baseTitle = input.title || '';
  const body = input.body || '';

  for (const subreddit of input.subreddits) {
    const reqs = input.postRequirements[subreddit];
    if (!reqs) continue;

    const suffix = input.titleSuffixes?.[subreddit] || '';
    const fullTitle = `${baseTitle}${suffix}`;

    // Check title blacklist
    if (reqs.title_blacklisted_strings && reqs.title_blacklisted_strings.length > 0) {
      const foundWords = findBlacklistedWords(fullTitle, reqs.title_blacklisted_strings);
      if (foundWords.length > 0) {
        issues.push({
          code: 'TITLE_BLACKLISTED_WORD',
          severity: 'error',
          subreddit,
          message: `r/${subreddit}: Title contains blacklisted word${foundWords.length > 1 ? 's' : ''}: "${foundWords.join('", "')}"`,
          suggestion: 'Remove or replace the blacklisted words from your title',
          field: 'title',
          expectedCategory: 'fixable_now',
        });
      }
    }

    // Check body blacklist
    if (body && reqs.body_blacklisted_strings && reqs.body_blacklisted_strings.length > 0) {
      const foundWords = findBlacklistedWords(body, reqs.body_blacklisted_strings);
      if (foundWords.length > 0) {
        issues.push({
          code: 'BODY_BLACKLISTED_WORD',
          severity: 'error',
          subreddit,
          message: `r/${subreddit}: Description contains blacklisted word${foundWords.length > 1 ? 's' : ''}: "${foundWords.join('", "')}"`,
          suggestion: 'Remove or replace the blacklisted words from your description',
          field: 'body',
          expectedCategory: 'fixable_now',
        });
      }
    }
  }

  return issues;
}

/**
 * Validates that required strings exist in title/body
 */
function validateRequiredStrings(input: PreflightInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const baseTitle = input.title || '';
  const body = input.body || '';

  for (const subreddit of input.subreddits) {
    const reqs = input.postRequirements[subreddit];
    if (!reqs) continue;

    const suffix = input.titleSuffixes?.[subreddit] || '';
    const fullTitle = `${baseTitle}${suffix}`;

    // Check title required strings (at least one must be present)
    if (reqs.title_required_strings && reqs.title_required_strings.length > 0) {
      const lowerTitle = fullTitle.toLowerCase();
      const hasRequired = reqs.title_required_strings.some(required => 
        lowerTitle.includes(required.toLowerCase())
      );
      
      if (!hasRequired) {
        // Format the required strings for display
        const formattedStrings = reqs.title_required_strings.length <= 5
          ? reqs.title_required_strings.join(', ')
          : `${reqs.title_required_strings.slice(0, 5).join(', ')}... (${reqs.title_required_strings.length} options)`;
        
        issues.push({
          code: 'TITLE_MISSING_REQUIRED_STRING',
          severity: 'warning',
          subreddit,
          message: `r/${subreddit}: Title should include one of: ${formattedStrings}`,
          suggestion: 'Add a required tag to your title using the dropdown or include it manually',
          field: 'title',
          expectedCategory: 'fixable_now',
        });
      }
    }

    // Check body required strings (at least one must be present)
    if (body && reqs.body_required_strings && reqs.body_required_strings.length > 0) {
      const lowerBody = body.toLowerCase();
      const hasRequired = reqs.body_required_strings.some(required => 
        lowerBody.includes(required.toLowerCase())
      );
      
      if (!hasRequired) {
        const formattedStrings = reqs.body_required_strings.length <= 5
          ? reqs.body_required_strings.join(', ')
          : `${reqs.body_required_strings.slice(0, 5).join(', ')}... (${reqs.body_required_strings.length} options)`;
        
        issues.push({
          code: 'BODY_MISSING_REQUIRED_STRING',
          severity: 'warning',
          subreddit,
          message: `r/${subreddit}: Description should include one of: ${formattedStrings}`,
          suggestion: 'Include a required string in your description',
          field: 'body',
          expectedCategory: 'fixable_now',
        });
      }
    }
  }

  return issues;
}

/**
 * Validates URL for link posts
 */
function validateUrl(input: PreflightInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (input.kind !== 'link') return issues;

  if (!input.url || !input.url.trim()) {
    issues.push({
      code: 'URL_REQUIRED',
      severity: 'error',
      message: 'URL is required for link posts',
      suggestion: 'Enter a URL',
      field: 'url',
      expectedCategory: 'fixable_now',
    });
    return issues;
  }

  // Basic URL validation
  try {
    const url = new URL(input.url);
    const domain = url.hostname.replace(/^www\./, '');

    // Check domain restrictions
    for (const subreddit of input.subreddits) {
      const reqs = input.postRequirements[subreddit];
      if (!reqs) continue;

      // Whitelist check
      if (reqs.domain_whitelist && reqs.domain_whitelist.length > 0) {
        const allowed = reqs.domain_whitelist.some(d => 
          domain === d || domain.endsWith(`.${d}`)
        );
        if (!allowed) {
          issues.push({
            code: 'DOMAIN_NOT_ALLOWED',
            severity: 'error',
            subreddit,
            message: `r/${subreddit}: Domain "${domain}" is not in the allowed list`,
            suggestion: `Allowed domains: ${reqs.domain_whitelist.join(', ')}`,
            field: 'url',
            expectedCategory: 'unfixable',
          });
        }
      }

      // Blacklist check
      if (reqs.domain_blacklist && reqs.domain_blacklist.length > 0) {
        const blocked = reqs.domain_blacklist.some(d => 
          domain === d || domain.endsWith(`.${d}`)
        );
        if (blocked) {
          issues.push({
            code: 'DOMAIN_BLOCKED',
            severity: 'error',
            subreddit,
            message: `r/${subreddit}: Domain "${domain}" is not allowed`,
            suggestion: 'Use a different link or remove this subreddit',
            field: 'url',
            expectedCategory: 'unfixable',
          });
        }
      }
    }
  } catch {
    issues.push({
      code: 'INVALID_URL',
      severity: 'error',
      message: 'The URL is not valid',
      suggestion: 'Check the URL format (should start with http:// or https://)',
      field: 'url',
      expectedCategory: 'fixable_now',
    });
  }

  return issues;
}

/**
 * Validates media for image/video/gallery posts
 */
function validateMedia(input: PreflightInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // For now, just check that media-based posts have the intent
  // Actual file validation happens at upload time
  if (input.kind === 'image' || input.kind === 'video' || input.kind === 'gallery') {
    // Media validation would require the actual files
    // This is more of a placeholder for future enhancement
  }

  return issues;
}

/**
 * General validations (cross-cutting concerns)
 */
function validateGeneral(input: PreflightInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // No subreddits selected
  if (input.subreddits.length === 0) {
    issues.push({
      code: 'NO_SUBREDDITS',
      severity: 'error',
      message: 'No communities selected',
      suggestion: 'Select at least one community to post to',
    });
  }

  // Too many subreddits warning
  if (input.subreddits.length > 10) {
    issues.push({
      code: 'MANY_SUBREDDITS',
      severity: 'info',
      message: `Posting to ${input.subreddits.length} communities may take a while`,
      suggestion: 'Posts will be spaced out to avoid rate limits',
    });
  }

  return issues;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Performs comprehensive pre-flight validation
 */
export function validatePreflight(input: PreflightInput): PreflightResult {
  const allIssues: ValidationIssue[] = [
    ...validateGeneral(input),
    ...validateTitle(input),
    ...validateBody(input),
    ...validateBlacklistedStrings(input),
    ...validateRequiredStrings(input),
    ...validateFlairs(input),
    ...validateUrl(input),
    ...validateMedia(input),
  ];

  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const info = allIssues.filter(i => i.severity === 'info');

  return {
    canProceed: errors.length === 0,
    issues: allIssues,
    counts: {
      errors: errors.length,
      warnings: warnings.length,
      info: info.length,
    },
    blockingErrors: errors,
  };
}

/**
 * Quick check for flair validation only
 */
export function validateFlairsOnly(input: Pick<PreflightInput, 'subreddits' | 'flairValue' | 'flairRequired' | 'flairOptions'>): {
  hasErrors: boolean;
  missingFlairs: string[];
} {
  const missingFlairs: string[] = [];

  for (const subreddit of input.subreddits) {
    const isRequired = input.flairRequired[subreddit];
    const hasSelected = !!input.flairValue[subreddit];

    if (isRequired && !hasSelected) {
      missingFlairs.push(subreddit);
    }
  }

  return {
    hasErrors: missingFlairs.length > 0,
    missingFlairs,
  };
}

/**
 * Get issues grouped by subreddit
 */
export function groupIssuesBySubreddit(issues: ValidationIssue[]): Record<string, ValidationIssue[]> {
  const grouped: Record<string, ValidationIssue[]> = {
    general: [],
  };

  for (const issue of issues) {
    const key = issue.subreddit || 'general';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(issue);
  }

  return grouped;
}

/**
 * Format issues for display
 */
export function formatIssuesSummary(result: PreflightResult): string {
  if (result.issues.length === 0) {
    return 'All checks passed';
  }

  const parts: string[] = [];

  if (result.counts.errors > 0) {
    parts.push(`${result.counts.errors} error${result.counts.errors !== 1 ? 's' : ''}`);
  }
  if (result.counts.warnings > 0) {
    parts.push(`${result.counts.warnings} warning${result.counts.warnings !== 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}
