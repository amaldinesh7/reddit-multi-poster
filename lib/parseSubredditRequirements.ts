/**
 * Parse subreddit requirements from text content (sidebar, wiki, submit_text)
 * Extracts karma, account age, and email verification requirements using regex patterns
 */

export interface ParsedRequirements {
  minKarma: number | null;
  minCommentKarma: number | null;
  minLinkKarma: number | null;
  minAccountAgeDays: number | null;
  requiresVerifiedEmail: boolean;
  blacklistedWords: string[];
  requiredTitlePrefixes: string[];
  confidence: 'high' | 'medium' | 'low';
  source: 'submit_text' | 'sidebar' | 'wiki' | 'unknown';
  rawExcerpt?: string;
}

// Karma requirement patterns - ordered by specificity
const KARMA_PATTERNS = [
  // "minimum 100 karma", "at least 100 karma", "require 100 karma"
  /(?:minimum|at\s*least|require[sd]?|need)\s*(\d+)\s*(?:total\s*)?karma/gi,
  // "100 karma required", "100 karma minimum"  
  /(\d+)\s*(?:total\s*)?karma\s*(?:required|minimum|needed)/gi,
  // "must have 100 karma"
  /must\s*have\s*(\d+)\s*(?:total\s*)?karma/gi,
  // "karma of at least 100", "karma requirement: 100"
  /karma\s*(?:of\s*)?(?:at\s*least|requirement[s]?[:\s]*)\s*(\d+)/gi,
];

// Comment karma specific patterns
const COMMENT_KARMA_PATTERNS = [
  /(?:minimum|at\s*least|require[sd]?|need)\s*(\d+)\s*comment\s*karma/gi,
  /(\d+)\s*comment\s*karma\s*(?:required|minimum|needed)/gi,
  /comment\s*karma\s*(?:of\s*)?(?:at\s*least|requirement[s]?[:\s]*)\s*(\d+)/gi,
];

// Link/post karma specific patterns
const LINK_KARMA_PATTERNS = [
  /(?:minimum|at\s*least|require[sd]?|need)\s*(\d+)\s*(?:link|post)\s*karma/gi,
  /(\d+)\s*(?:link|post)\s*karma\s*(?:required|minimum|needed)/gi,
  /(?:link|post)\s*karma\s*(?:of\s*)?(?:at\s*least|requirement[s]?[:\s]*)\s*(\d+)/gi,
];

// Account age patterns - ordered by specificity
const ACCOUNT_AGE_PATTERNS = [
  // Days: "30 days old", "account age of 30 days", "30 day old account"
  /(?:account\s*)?(?:must\s*be\s*)?(?:at\s*least\s*)?(\d+)\s*days?\s*old/gi,
  /account\s*age\s*(?:of\s*)?(?:at\s*least\s*)?(\d+)\s*days?/gi,
  /(\d+)\s*days?\s*(?:old\s*)?account/gi,
  /(?:minimum|at\s*least|require[sd]?)\s*(\d+)\s*days?/gi,
  
  // Weeks: "2 weeks old", "account age of 2 weeks"
  /(?:account\s*)?(?:must\s*be\s*)?(?:at\s*least\s*)?(\d+)\s*weeks?\s*old/gi,
  /account\s*age\s*(?:of\s*)?(?:at\s*least\s*)?(\d+)\s*weeks?/gi,
  /(\d+)\s*weeks?\s*(?:old\s*)?account/gi,
  
  // Months: "3 months old", "account age of 3 months"  
  /(?:account\s*)?(?:must\s*be\s*)?(?:at\s*least\s*)?(\d+)\s*months?\s*old/gi,
  /account\s*age\s*(?:of\s*)?(?:at\s*least\s*)?(\d+)\s*months?/gi,
  /(\d+)\s*months?\s*(?:old\s*)?account/gi,
];

// Email verification patterns
const EMAIL_VERIFICATION_PATTERNS = [
  /verified?\s*email/gi,
  /email\s*(?:must\s*be\s*)?verified?/gi,
  /email\s*verification\s*required/gi,
  /require[sd]?\s*(?:a\s*)?verified?\s*email/gi,
  /must\s*(?:have\s*)?(?:a\s*)?verified?\s*email/gi,
];

// Title prefix requirement patterns
const TITLE_PREFIX_PATTERNS = [
  /title[s]?\s*must\s*(?:start|begin)\s*with\s*[\["']?([^\]"'\n]+)[\]"']?/gi,
  /\[([A-Z]{1,4})\]\s*(?:tag|prefix|flair)\s*(?:required|mandatory)/gi,
  /(?:required|mandatory)\s*(?:tag|prefix|flair)[:\s]*\[([A-Z]{1,4})\]/gi,
];

/**
 * Extract the first number from regex matches
 */
function extractNumber(text: string, patterns: RegExp[]): { value: number | null; excerpt: string | null } {
  for (const pattern of patterns) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      const value = parseInt(match[1], 10);
      if (!isNaN(value) && value > 0) {
        // Get surrounding context (50 chars before and after)
        const start = Math.max(0, match.index - 50);
        const end = Math.min(text.length, match.index + match[0].length + 50);
        const excerpt = text.slice(start, end).replace(/\n+/g, ' ').trim();
        return { value, excerpt: `...${excerpt}...` };
      }
    }
  }
  return { value: null, excerpt: null };
}

/**
 * Check if text matches any pattern in the array
 */
function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/**
 * Extract title prefixes from text
 */
function extractTitlePrefixes(text: string): string[] {
  const prefixes: string[] = [];
  for (const pattern of TITLE_PREFIX_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        prefixes.push(match[1].trim());
      }
    }
  }
  return [...new Set(prefixes)]; // Remove duplicates
}

/**
 * Convert weeks/months to days for account age
 */
function convertToDays(text: string): number | null {
  // Check for weeks
  const weeksMatch = text.match(/(\d+)\s*weeks?/i);
  if (weeksMatch) {
    return parseInt(weeksMatch[1], 10) * 7;
  }
  
  // Check for months
  const monthsMatch = text.match(/(\d+)\s*months?/i);
  if (monthsMatch) {
    return parseInt(monthsMatch[1], 10) * 30;
  }
  
  // Check for days
  const daysMatch = text.match(/(\d+)\s*days?/i);
  if (daysMatch) {
    return parseInt(daysMatch[1], 10);
  }
  
  return null;
}

/**
 * Parse requirements from subreddit text content
 * @param text - Combined text from sidebar, submit_text, and wiki
 * @param source - Where the text came from (for confidence scoring)
 * @returns Parsed requirements object
 */
export function parseRequirementsFromText(
  text: string, 
  source: 'submit_text' | 'sidebar' | 'wiki' | 'unknown' = 'unknown'
): ParsedRequirements {
  if (!text || text.trim().length === 0) {
    return createEmptyRequirements(source);
  }

  // Normalize text for parsing
  const normalizedText = text
    .toLowerCase()
    .replace(/[*_~`]/g, '') // Remove markdown formatting
    .replace(/\s+/g, ' '); // Normalize whitespace

  let rawExcerpt: string | undefined;
  let confidenceScore = 0;

  // Extract karma requirements
  const karmaResult = extractNumber(normalizedText, KARMA_PATTERNS);
  const commentKarmaResult = extractNumber(normalizedText, COMMENT_KARMA_PATTERNS);
  const linkKarmaResult = extractNumber(normalizedText, LINK_KARMA_PATTERNS);

  if (karmaResult.value || commentKarmaResult.value || linkKarmaResult.value) {
    confidenceScore += 2;
    rawExcerpt = karmaResult.excerpt || commentKarmaResult.excerpt || linkKarmaResult.excerpt || undefined;
  }

  // Extract account age
  let minAccountAgeDays: number | null = null;
  for (const pattern of ACCOUNT_AGE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(normalizedText);
    if (match) {
      const value = parseInt(match[1], 10);
      if (!isNaN(value) && value > 0) {
        // Determine unit and convert to days
        const matchContext = normalizedText.slice(
          Math.max(0, match.index - 10),
          Math.min(normalizedText.length, match.index + match[0].length + 20)
        );
        
        if (matchContext.includes('week')) {
          minAccountAgeDays = value * 7;
        } else if (matchContext.includes('month')) {
          minAccountAgeDays = value * 30;
        } else {
          minAccountAgeDays = value;
        }
        
        confidenceScore += 2;
        if (!rawExcerpt) {
          const start = Math.max(0, match.index - 50);
          const end = Math.min(text.length, match.index + match[0].length + 50);
          rawExcerpt = `...${text.slice(start, end).replace(/\n+/g, ' ').trim()}...`;
        }
        break;
      }
    }
  }

  // Check for email verification requirement
  const requiresVerifiedEmail = matchesAny(normalizedText, EMAIL_VERIFICATION_PATTERNS);
  if (requiresVerifiedEmail) {
    confidenceScore += 1;
  }

  // Extract title prefixes
  const requiredTitlePrefixes = extractTitlePrefixes(text);
  if (requiredTitlePrefixes.length > 0) {
    confidenceScore += 1;
  }

  // Source-based confidence boost
  if (source === 'submit_text') {
    confidenceScore += 1; // Submit text is most reliable
  } else if (source === 'wiki') {
    confidenceScore += 0.5; // Wiki is moderately reliable
  }

  // Determine overall confidence
  let confidence: 'high' | 'medium' | 'low';
  if (confidenceScore >= 3) {
    confidence = 'high';
  } else if (confidenceScore >= 1) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    minKarma: karmaResult.value,
    minCommentKarma: commentKarmaResult.value,
    minLinkKarma: linkKarmaResult.value,
    minAccountAgeDays,
    requiresVerifiedEmail,
    blacklistedWords: [], // Future: could parse these from rules
    requiredTitlePrefixes,
    confidence,
    source,
    rawExcerpt,
  };
}

/**
 * Create empty requirements object
 */
function createEmptyRequirements(source: 'submit_text' | 'sidebar' | 'wiki' | 'unknown'): ParsedRequirements {
  return {
    minKarma: null,
    minCommentKarma: null,
    minLinkKarma: null,
    minAccountAgeDays: null,
    requiresVerifiedEmail: false,
    blacklistedWords: [],
    requiredTitlePrefixes: [],
    confidence: 'low',
    source,
    rawExcerpt: undefined,
  };
}

/**
 * Merge multiple parsed requirements, preferring higher-confidence sources
 * @param requirements - Array of parsed requirements from different sources
 * @returns Merged requirements object
 */
export function mergeRequirements(requirements: ParsedRequirements[]): ParsedRequirements {
  if (requirements.length === 0) {
    return createEmptyRequirements('unknown');
  }

  if (requirements.length === 1) {
    return requirements[0];
  }

  // Sort by confidence (high > medium > low) and source priority (submit_text > wiki > sidebar)
  const sourcePriority: Record<string, number> = {
    'submit_text': 3,
    'wiki': 2,
    'sidebar': 1,
    'unknown': 0,
  };

  const confidencePriority: Record<string, number> = {
    'high': 3,
    'medium': 2,
    'low': 1,
  };

  const sorted = [...requirements].sort((a, b) => {
    const confDiff = confidencePriority[b.confidence] - confidencePriority[a.confidence];
    if (confDiff !== 0) return confDiff;
    return sourcePriority[b.source] - sourcePriority[a.source];
  });

  // Merge: take the first non-null value for each field
  const merged: ParsedRequirements = {
    minKarma: sorted.find(r => r.minKarma !== null)?.minKarma ?? null,
    minCommentKarma: sorted.find(r => r.minCommentKarma !== null)?.minCommentKarma ?? null,
    minLinkKarma: sorted.find(r => r.minLinkKarma !== null)?.minLinkKarma ?? null,
    minAccountAgeDays: sorted.find(r => r.minAccountAgeDays !== null)?.minAccountAgeDays ?? null,
    requiresVerifiedEmail: sorted.some(r => r.requiresVerifiedEmail),
    blacklistedWords: [...new Set(sorted.flatMap(r => r.blacklistedWords))],
    requiredTitlePrefixes: [...new Set(sorted.flatMap(r => r.requiredTitlePrefixes))],
    confidence: sorted[0].confidence, // Use highest confidence
    source: sorted.find(r => r.rawExcerpt)?.source ?? sorted[0].source,
    rawExcerpt: sorted.find(r => r.rawExcerpt)?.rawExcerpt,
  };

  return merged;
}

/**
 * Compare user stats against parsed requirements
 * @param user - User data with karma and account info
 * @param requirements - Parsed requirements from subreddit
 * @returns Comparison result for display
 */
export interface UserRequirementComparison {
  karmaStatus: 'ok' | 'low' | 'unknown';
  commentKarmaStatus: 'ok' | 'low' | 'unknown';
  linkKarmaStatus: 'ok' | 'low' | 'unknown';
  ageStatus: 'ok' | 'low' | 'unknown';
  emailStatus: 'ok' | 'missing' | 'unknown';
  overallStatus: 'ok' | 'warning' | 'blocked';
  warnings: string[];
}

export function compareUserToRequirements(
  user: {
    totalKarma: number;
    commentKarma: number;
    linkKarma: number;
    accountAgeDays: number;
    hasVerifiedEmail: boolean;
  },
  requirements: ParsedRequirements
): UserRequirementComparison {
  const warnings: string[] = [];

  // Check total karma
  let karmaStatus: 'ok' | 'low' | 'unknown' = 'unknown';
  if (requirements.minKarma !== null) {
    if (user.totalKarma >= requirements.minKarma) {
      karmaStatus = 'ok';
    } else {
      karmaStatus = 'low';
      warnings.push(`You have ${user.totalKarma} karma, but this subreddit may require ${requirements.minKarma}+`);
    }
  }

  // Check comment karma
  let commentKarmaStatus: 'ok' | 'low' | 'unknown' = 'unknown';
  if (requirements.minCommentKarma !== null) {
    if (user.commentKarma >= requirements.minCommentKarma) {
      commentKarmaStatus = 'ok';
    } else {
      commentKarmaStatus = 'low';
      warnings.push(`You have ${user.commentKarma} comment karma, but this subreddit may require ${requirements.minCommentKarma}+`);
    }
  }

  // Check link karma
  let linkKarmaStatus: 'ok' | 'low' | 'unknown' = 'unknown';
  if (requirements.minLinkKarma !== null) {
    if (user.linkKarma >= requirements.minLinkKarma) {
      linkKarmaStatus = 'ok';
    } else {
      linkKarmaStatus = 'low';
      warnings.push(`You have ${user.linkKarma} post karma, but this subreddit may require ${requirements.minLinkKarma}+`);
    }
  }

  // Check account age
  let ageStatus: 'ok' | 'low' | 'unknown' = 'unknown';
  if (requirements.minAccountAgeDays !== null) {
    if (user.accountAgeDays >= requirements.minAccountAgeDays) {
      ageStatus = 'ok';
    } else {
      ageStatus = 'low';
      warnings.push(`Your account is ${user.accountAgeDays} days old, but this subreddit may require ${requirements.minAccountAgeDays}+ days`);
    }
  }

  // Check email verification
  let emailStatus: 'ok' | 'missing' | 'unknown' = 'unknown';
  if (requirements.requiresVerifiedEmail) {
    if (user.hasVerifiedEmail) {
      emailStatus = 'ok';
    } else {
      emailStatus = 'missing';
      warnings.push('This subreddit may require a verified email address');
    }
  }

  // Determine overall status
  let overallStatus: 'ok' | 'warning' | 'blocked' = 'ok';
  if (warnings.length > 0) {
    // If any karma/age is low, it's likely a block
    if (karmaStatus === 'low' || commentKarmaStatus === 'low' || 
        linkKarmaStatus === 'low' || ageStatus === 'low' || emailStatus === 'missing') {
      overallStatus = 'warning';
    }
  }

  return {
    karmaStatus,
    commentKarmaStatus,
    linkKarmaStatus,
    ageStatus,
    emailStatus,
    overallStatus,
    warnings,
  };
}
